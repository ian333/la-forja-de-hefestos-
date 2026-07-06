// FORJA BOOST3 v3 — boost + DESCARGA (válvula) del v2, 1 fase, 60V, 1 Pico.
//   (2026-06-16) Antes solo cargaba la presa; ahora también HACE LA GOTA.
//
// ETAPAS (ver docs/forja-v2-completo.pdf):
//   BOOST   : GP16 PWM 100kHz -> Q1 (IRF640N) -> D1 (MUR) -> PRESA (5x2200uF).
//             control PROPORCIONAL anti-overshoot (mata el "putazo" a 50V).
//   DESCARGA: GP15 -> MOC3021 -> BTA24-600BW (TRIAC) -> choke (41uH) -> contacto.
//             UN DISPARO por gota; el triac LATCHA y se auto-conmuta al vaciarse
//             la presa (no se apaga por gate). v3-triac: el MOSFET moría por
//             Miller turn-on del arco — el triac no (ver memoria forja-v2-bringup).
//   KILL    : GP14 -> SD del IR2110 del BOOST (Q1). HIGH=mata, LOW=corre.
//             OJO: el KILL ya NO aborta la descarga (el triac es independiente).
//
// SENSADO (con filtro RC a cada ADC): GP26=shunt1(boost ADC0) · GP27=shunt2(ADC1)
//   · GP28=Vbus÷41 (ADC2). El firmware toma MEDIANA de 7 (anti-ruido).
//
// CALIBRACIÓN sin medir 0.1Ω (tu multímetro no llega):
//   - DIV_RATIO: energiza, lee tu multímetro en el bus, y ajusta con V/v hasta
//     que el Vbus mostrado = el del multímetro. (el bus SÍ lo mides en volts.)
//   - R_SHUNT: o confías en el 0.1Ω±5% del RA-.1E, o lo calibras pasando una
//     corriente CONOCIDA (fuente en CC) y ajustas con J/j hasta que Ipk = esa I.
//
// SEGURIDAD: arranca STOP + KILL · soft-start · clamp duro · watchdog ·
//   banda de descarga TOPADA a 30A (el shunt 0.1Ω satura el ADC a 33A) · 🥽 una mano.
#include "pico/stdlib.h"
#include "hardware/adc.h"
#include "hardware/pwm.h"
#include "hardware/gpio.h"
#include <stdio.h>
#include <stdbool.h>

#define PIN_F1        16            // boost fase 1 (slice 0)
#define PIN_F2        18            // fase 2 (no usada en v2 simplificado)
#define PIN_F3        20            // fase 3 (idem)
#define PIN_DISCH     15            // VÁLVULA (Q2) — descarga
#define PIN_KILL      14            // SD de ambos IR2110: HIGH=mata, LOW=corre
#define PIN_LED       25

#define VREF          3.3f
#define ADCMAX        4095.0f
#define C_BUS         11000e-6f     // PRESA = 5x CE-2200/200V en ‖
#define NMED          7

#define FSW_HZ        100000.0f
#define SYSCLK        150000000.0f
#define WRAP          ((uint32_t)(SYSCLK/FSW_HZ) - 1)   // 1499 -> 100 kHz
#define DUTY_MAX0     0.55f
#define BOOST_SOFT    0.0003f       // loop 10ms (4x mas rapido): paso /4 = misma rampa/s
#define VTGT0         60.0f         // v2: trabajamos a 60V
#define VTGT_MAX      90.0f         // cabeza hasta ~90V, NO 120 (margen de caps/TVS)
#define CLAMP_MARGIN  12.0f
#define CLAMP_MAX     95.0f

// --- descarga (gota) ---
#define IDROP_LO0     15.0f         // banda de corriente: arranque GENTIL
#define IDROP_HI0     22.0f
#define IDROP_CEIL    30.0f         // tope duro (shunt 0.1Ω satura el ADC ~33A)
#define TDROP0_MS     3             // duración del pulso de gota

// calibrables en caliente (no #define) — por eso tu multímetro de 0.1Ω no estorba
static float div_ratio = 41.0f;     // 2x200k+10k -> ÷41
static float r_shunt   = 0.10f;     // RA-.1E

static uint sl[3], ch[3];
static bool fase_on[3] = { true, false, false };   // v2: SOLO fase 1
static float duty = 0.0f, duty_max = DUTY_MAX0;
static float vtarget = VTGT0;
static bool charging = false;
// descarga
static float idrop_lo = IDROP_LO0, idrop_hi = IDROP_HI0;
static uint32_t tdrop_ms = TDROP0_MS;
static bool autodrop = false;

static inline void kill_on(void){  gpio_put(PIN_KILL, 1); }  // SD HIGH = mata gates
static inline void kill_off(void){ gpio_put(PIN_KILL, 0); }  // SD LOW  = habilita

static uint16_t med_ch(int c){
    adc_select_input(c);
    uint16_t b[NMED];
    for(int k=0;k<NMED;k++) b[k]=adc_read();
    for(int i=1;i<NMED;i++){ uint16_t v=b[i]; int j=i-1;
        while(j>=0 && b[j]>v){ b[j+1]=b[j]; j--; } b[j+1]=v; }
    return b[NMED/2];
}
static float vbus(void){ return med_ch(2)*VREF/ADCMAX*div_ratio; }   // ADC2 = GP28

// pico de corriente por el shunt1 del boost (ADC0 = GP26)
static float ipk_shunt(void){
    adc_select_input(0);
    uint16_t mx=0;
    for(int k=0;k<48;k++){ uint16_t v=adc_read(); if(v>mx)mx=v; }
    return mx*VREF/ADCMAX/r_shunt;
}
// cuentas ADC del shunt2 (descarga) para una corriente dada
static uint16_t amps_to_counts(float a){
    float v=a*r_shunt; if(v>VREF) v=VREF;          // no pedir arriba del ADC
    int c=(int)(v/VREF*ADCMAX); if(c<0)c=0; if(c>4090)c=4090; return (uint16_t)c;
}

static void set_duty_all(float d){
    if(d<0)d=0; if(d>duty_max)d=duty_max;
    duty=d;
    for(int k=0;k<3;k++)
        pwm_set_chan_level(sl[k], ch[k], fase_on[k] ? (uint16_t)(d*WRAP) : 0);
}
static void all_off(void){ charging=false; autodrop=false; set_duty_all(0); duty=0;
                           gpio_put(PIN_DISCH,0); kill_on(); }

static float clamp_v(void){ float c=vtarget+CLAMP_MARGIN; return c>CLAMP_MAX?CLAMP_MAX:c; }

// ============ LA GOTA: DISPARO del TRIAC (descarga de capacitor) ============
// v3-triac (docs/forja-v3-triac.pdf): el switch de descarga ya NO es el MOSFET
// con bang-bang — es un BTA24-600BW disparado por el MOC3021 (GP15 -> LED del
// opto -> gate del triac). DIFERENCIA CLAVE vs el MOSFET:
//   · El triac LATCHA con el disparo y conduce SOLO; NO se apaga por gate.
//   · Se AUTO-conmuta cuando la corriente cae bajo su holding (la presa se vacía).
//   · Por eso NO hay banda/histéresis/corriente-control: es UN disparo por gota.
// Mantenemos el gate durante la ventana por si el rizado del choke lo apagara
// antes de vaciar la presa (lo re-dispara). El shunt2 solo da telemetría del pico.
// (El KILL/IR2110 ya NO aborta la descarga: el triac es independiente. El E-stop
//  real de la descarga = no cargar / drenar la presa.)
static void do_drop(uint32_t t_ms){
    adc_select_input(1);                          // ADC1 = GP27 = shunt2 (telemetría)
    uint16_t ipk_c = 0;
    gpio_put(PIN_DISCH, 1);                        // DISPARA el triac (MOC3021 LED ON)
    absolute_time_t end = make_timeout_time_ms(t_ms);
    while(!time_reached(end)){
        uint16_t i = adc_read(); if(i > ipk_c) ipk_c = i;
    }
    gpio_put(PIN_DISCH, 0);                         // suelta el gate; el triac muere al vaciarse la presa
    float ipk = ipk_c*VREF/ADCMAX/r_shunt;
    printf(">> GOTA (triac): disparo %lums · Ipico~%.0fA%s\n",
           (unsigned long)t_ms,(double)ipk, ipk_c>=4080?" (SATURADO: shunt 0.1Ω topa ~33A — pon shunt 1mΩ para ver más)":"");
}

int main(void){
    stdio_init_all();
    adc_init(); adc_gpio_init(26); adc_gpio_init(27); adc_gpio_init(28);
    gpio_init(PIN_LED);  gpio_set_dir(PIN_LED, GPIO_OUT);
    gpio_init(PIN_KILL); gpio_set_dir(PIN_KILL, GPIO_OUT); kill_on();   // arranca MATADO
    gpio_init(PIN_DISCH);gpio_set_dir(PIN_DISCH,GPIO_OUT); gpio_put(PIN_DISCH,0);

    const uint pins[3] = { PIN_F1, PIN_F2, PIN_F3 };
    uint32_t mask = 0;
    for(int k=0;k<3;k++){
        gpio_set_function(pins[k], GPIO_FUNC_PWM);
        sl[k]=pwm_gpio_to_slice_num(pins[k]); ch[k]=pwm_gpio_to_channel(pins[k]);
        pwm_set_enabled(sl[k], false);
        pwm_set_wrap(sl[k], WRAP);
        pwm_set_chan_level(sl[k], ch[k], 0);
        pwm_set_counter(sl[k], (uint16_t)((uint32_t)WRAP*k/3));
        mask |= (1u<<sl[k]);
    }
    pwm_set_mask_enabled(mask);

    sleep_ms(1500);
    printf("== BOOST3 v3 (boost + DESCARGA) ==\n");
    printf("  g=cargar presa  o=boost off  s=STOP/KILL | p=1 gota  P=auto-gotas\n");
    printf("  T/t target(±10) | D/d dutymax | b/B banda corriente | u/U dur gota\n");
    printf("  V/v calib divisor(Vbus) | J/j calib shunt(corriente) | r=reporte | k=KILL\n");
    printf("  target %.0fV · banda gota %.0f-%.0fA · dur %lums · 60V · 🥽\n",
           (double)vtarget,(double)idrop_lo,(double)idrop_hi,(unsigned long)tdrop_ms);

    int rpt=0, stuck=0;
    while(true){
        float vc = vbus();

        if(vc > clamp_v()){ all_off(); printf("!! CLAMP %.1fV > %.1fV — OFF\n",(double)vc,(double)clamp_v()); }
        if(charging && duty > 0.30f && vc < 26.0f){
            if(++stuck > 200){ all_off(); stuck=0;
                printf("!! WATCHDOG: duty %.0f%% y Vbus=%.1fV no sube — revisa. OFF\n",
                       (double)(duty*100),(double)vc); }
        } else stuck=0;

        int c=getchar_timeout_us(0);
        if(c=='g'){ charging=true; duty=0; kill_off(); printf(">> CARGAR presa a %.0fV\n",(double)vtarget); }
        else if(c=='o'){ charging=false; set_duty_all(0); printf(">> BOOST OFF\n"); }
        else if(c=='s'){ all_off(); printf(">> STOP + KILL\n"); }
        else if(c=='k'){ all_off(); printf(">> KILL (SD alto, gates muertos)\n"); }
        else if(c=='p'){                                   // UNA gota (necesita presa cargada)
            if(vc < vtarget*0.8f) printf(">> presa baja (%.1fV) — carga primero con g\n",(double)vc);
            else { printf(">> disparo 1 gota...\n"); do_drop(tdrop_ms); }
        }
        else if(c=='P'){ autodrop=!autodrop; printf(">> AUTO-GOTAS %s (carga+dispara repetido)\n",autodrop?"ON":"OFF");
            if(autodrop) charging=true, kill_off(); }
        else if(c>='1'&&c<='3'){ int k=c-'1'; fase_on[k]=!fase_on[k]; set_duty_all(duty);
            printf(">> FASES [%s%s%s]\n",fase_on[0]?"1":"-",fase_on[1]?"2":"-",fase_on[2]?"3":"-"); }
        else if(c=='T'){ vtarget+=10; if(vtarget>VTGT_MAX)vtarget=VTGT_MAX; printf(">> target %.0fV (clamp %.0fV)\n",(double)vtarget,(double)clamp_v()); }
        else if(c=='t'){ vtarget-=10; if(vtarget<30)vtarget=30; printf(">> target %.0fV\n",(double)vtarget); }
        else if(c=='D'){ duty_max+=0.05f; if(duty_max>0.70f)duty_max=0.70f; printf(">> duty_max %.2f\n",(double)duty_max); }
        else if(c=='d'){ duty_max-=0.05f; if(duty_max<0.10f)duty_max=0.10f; printf(">> duty_max %.2f\n",(double)duty_max); }
        else if(c=='B'){ idrop_hi+=2; idrop_lo+=2; if(idrop_hi>IDROP_CEIL){idrop_hi=IDROP_CEIL;idrop_lo=IDROP_CEIL-7;} printf(">> banda gota %.0f-%.0fA\n",(double)idrop_lo,(double)idrop_hi); }
        else if(c=='b'){ idrop_hi-=2; idrop_lo-=2; if(idrop_lo<5){idrop_lo=5;idrop_hi=12;} printf(">> banda gota %.0f-%.0fA\n",(double)idrop_lo,(double)idrop_hi); }
        else if(c=='U'){ if(tdrop_ms<20)tdrop_ms++; printf(">> dur gota %lums\n",(unsigned long)tdrop_ms); }
        else if(c=='u'){ if(tdrop_ms>1)tdrop_ms--; printf(">> dur gota %lums\n",(unsigned long)tdrop_ms); }
        else if(c=='V'){ div_ratio+=0.5f; printf(">> DIV_RATIO=%.1f (Vbus=%.1fV) — ajusta hasta = tu multímetro\n",(double)div_ratio,(double)vbus()); }
        else if(c=='v'){ div_ratio-=0.5f; printf(">> DIV_RATIO=%.1f (Vbus=%.1fV)\n",(double)div_ratio,(double)vbus()); }
        else if(c=='J'){ r_shunt+=0.005f; printf(">> R_SHUNT=%.3fΩ (Ipk=%.1fA)\n",(double)r_shunt,(double)ipk_shunt()); }
        else if(c=='j'){ r_shunt-=0.005f; if(r_shunt<0.01f)r_shunt=0.01f; printf(">> R_SHUNT=%.3fΩ (Ipk=%.1fA)\n",(double)r_shunt,(double)ipk_shunt()); }
        else if(c=='r'){
            float v1=vbus(); sleep_ms(200); float v2=vbus();
            float dvdt=(v2-v1)/0.2f, icharge=C_BUS*dvdt, ipk=ipk_shunt();
            printf("== REPORTE: Vbus=%.1fV/tgt%.0f duty=%.1f%% | DIV=%.1f R_sh=%.3fΩ\n",
                   (double)v2,(double)vtarget,(double)(duty*100),(double)div_ratio,(double)r_shunt);
            printf("   dV/dt=%.1fV/s Icarga=%.2fA shunt1~%.1fA | gota: banda %.0f-%.0fA dur %lums\n",
                   (double)dvdt,(double)icharge,(double)ipk,(double)idrop_lo,(double)idrop_hi,(unsigned long)tdrop_ms);
        }

        // lazo de carga proporcional (anti-overshoot)
        if(charging){
            float err = vtarget - vc;
            if(err > 0.5f){ float frac=err/10.0f; if(frac>1.0f)frac=1.0f; set_duty_all(duty + BOOST_SOFT*frac); }
            else if(err < -0.5f){ set_duty_all(duty - 0.00375f + err*0.005f); }
        }

        // AUTO-GOTAS: cuando la presa está lista, dispara una gota y deja recargar
        if(autodrop && vc >= vtarget*0.95f){
            do_drop(tdrop_ms);
            // tras la gota la presa bajó; el lazo de carga la rellena solo
        }

        gpio_put(PIN_LED, vc >= vtarget*0.9f ? 1 : 0);

        if(++rpt>=4){ rpt=0;
            printf("[%s%s] duty=%4.1f%% | Vbus=%5.1fV/tgt%.0f | gota %.0f-%.0fA\n",
                   charging?"CHRG":"STOP", autodrop?"+AUTO":"",
                   (double)(duty*100),(double)vc,(double)vtarget,(double)idrop_lo,(double)idrop_hi);
        }
        sleep_ms(10);
    }
}
