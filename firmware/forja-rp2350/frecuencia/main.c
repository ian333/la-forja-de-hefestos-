// FORJA FRECUENCIA v3 — control por FRECUENCIA + 2da onda + palpador de altura.
//
// La energia va en PAQUETES por PWM (no un golpe): f1 + duty modulan la corriente
// -> calentamiento CONTROLADO. NUEVO: (1) 2DA ONDA = el carrier va a f1 y el DUTY
// se modula a f2 (sacude la gota a su resonancia, drop-on-demand). (2) PALPADOR:
// la varilla es su propio sensor de altura via R=V/I (toca -> R cae -> esa es la Z).
//
// COMANDOS:
//   g=cargar  o=boost-off  s=stop
//   f=FRECUENCIA (rafagas)   b=barrido   p=pulso   z=PALPADOR de altura
//   2=2da onda ON/OFF        k/j = f2 +/-
//   + / -  f1 x1.25          < / >  duty -+5%
// SEGURIDAD: CLAMP DURO 44V. rampa suave. arranca boost OFF. 🥽
#include "pico/stdlib.h"
#include "hardware/adc.h"
#include "hardware/pwm.h"
#include "hardware/gpio.h"
#include <stdio.h>
#include <stdbool.h>

#define PIN_BOOST     16
#define PIN_DISCH     15
#define DIV_RATIO     33.0f          // divisor MEDIDO 320k/10k -> ratio 33, lee hasta ~109V
#define VREF          3.3f
#define ADCMAX        4095.0f
#define C_HV          2200e-6f
#define NMED          7
#define BOOST_WRAP    3000
#define TARGET_V      66.0f          // ~55W = charco robusto (con 60F30 300V + divisor 31)
#define CONT_TARGET   66.0f
#define CLAMP_V       75.0f          // CORTE DURO: 25V de margen a los MOSFET de 100V
#define DUTY_MAX      0.72f
#define BOOST_SOFT    0.0012f        // rampa MUY lenta anti-jalon (la fuente protegia con el inrush a 66V)
#define DISCH_DIV     4.0f
#define SYSCLK        150000000.0f
#define WINDOW_US     60000
#define PROBE_US      20000
#define PULSE_US      30000

enum { STOP, CHARGE, FREQ, PULSE, SWEEP, PROBE, CONT };

static uint sb, cb, sd, cd;
static float boost_duty = 0.0f;
static bool  boost_on = false;
static float disch_f = 120.0f, disch_duty = 0.60f;    // arranca en zona de FUSION (120Hz, pulsos largos)
static uint32_t disch_wrap = 2000;
static int mode = STOP;
// --- 2da onda ---
static bool  dual_on = false;
static float disch_f2 = 500.0f;     // modula el duty (resonancia de la gota)
static float dual_depth = 0.25f;    // amplitud de la modulacion del duty

static uint16_t med_ch(int ch){
    adc_select_input(ch);
    uint16_t b[NMED];
    for(int k=0;k<NMED;k++) b[k]=adc_read();
    for(int i=1;i<NMED;i++){ uint16_t v=b[i]; int j=i-1;
        while(j>=0 && b[j]>v){ b[j+1]=b[j]; j--; } b[j+1]=v; }
    return b[NMED/2];
}
static float vcap(void){ return med_ch(2)*VREF/ADCMAX*DIV_RATIO; }

static void set_boost(float d){
    if(d<0)d=0; if(d>DUTY_MAX)d=DUTY_MAX;
    pwm_set_chan_level(sb, cb, (uint16_t)((1.0f-d)*BOOST_WRAP));
}
static void disch_config(float f){
    // escoge el divisor segun la frecuencia para que el wrap quepa en 16 bits
    float div = (f < 600.0f) ? 64.0f : (f < 2500.0f) ? 16.0f : DISCH_DIV;
    uint32_t w=(uint32_t)(SYSCLK/(div*f))-1;
    if(w>65535)w=65535; if(w<50)w=50;
    disch_wrap=w;
    pwm_set_clkdiv(sd, div);
    pwm_set_wrap(sd,w);
}
static void disch_set_duty(float duty){
    if(duty<0.05f)duty=0.05f; if(duty>0.9f)duty=0.9f;
    pwm_set_chan_level(sd, cd, (uint16_t)((1.0f-duty)*(disch_wrap+1)));
}
static void disch_off(void){ pwm_set_chan_level(sd, cd, disch_wrap+2); }
static void disch_full_on(void){ pwm_set_chan_level(sd, cd, 0); }

static bool clamp_check(float vc){
    if(vc > CLAMP_V){ boost_on=false; boost_duty=0; set_boost(0); return true; }
    return false;
}

static void recargar(float target_v){
    uint32_t t0=to_ms_since_boot(get_absolute_time());
    boost_on=true;
    boost_duty = 0.0f;                 // ARRANCA DE 0 cada recarga (anti-jalon: la fuente
                                       // protegia porque el duty saltaba a ~60% de golpe)
    while(to_ms_since_boot(get_absolute_time())-t0 < 5000){
        float vc=vcap();
        if(clamp_check(vc)) break;
        if(vc>=target_v) break;
        boost_duty += 0.003f;          // rampa suave DESDE 0 (gentil con la fuente)
        if(boost_duty>DUTY_MAX)boost_duty=DUTY_MAX;
        set_boost(boost_duty);
        sleep_ms(6);
    }
    boost_on=false; set_boost(0);
}

// onda triangular -1..1 a frecuencia f2 (sin math.h)
static float tri_f2(float t){
    float ph = disch_f2*t; ph -= (float)((int)ph);     // parte fraccionaria 0..1
    return (ph<0.5f)? (4.0f*ph-1.0f) : (3.0f-4.0f*ph);
}

// UNA rafaga medida a (f1,duty). Si dual_on, el duty se modula a f2.
static void medir_rafaga(float f, float duty){
    sleep_ms(3);
    disch_config(f);
    float vb=vcap();
    if(dual_on){
        uint32_t t0=time_us_32();
        while(time_us_32()-t0 < WINDOW_US){
            float t=(time_us_32()-t0)*1e-6f;
            disch_set_duty(duty + dual_depth*tri_f2(t));   // 2da onda en el duty
            busy_wait_us(40);
        }
    } else {
        disch_set_duty(duty);
        busy_wait_us(WINDOW_US);
    }
    disch_off();
    float va=vcap();
    float dv=vb-va, vavg=(vb+va)*0.5f;
    float Iavg=(dv>0)?(C_HV*dv)/(WINDOW_US*1e-6f):0.0f;
    float Ion =(duty>0)?Iavg/duty:0.0f;
    float R   =(Ion>0)?vavg/Ion:0.0f;
    float P   =0.5f*C_HV*(vb*vb-va*va)/(WINDOW_US*1e-6f);
    if(dual_on)
        printf("  f1=%.0f+f2=%.0fHz duty=%.2f | dV=%.2f | Ion=%.1fA | R=%.1fohm | P=%.0fW [2 ONDAS]\n",
               (double)f,(double)disch_f2,(double)duty,(double)dv,(double)Ion,(double)R,(double)P);
    else
        printf("  f=%6.0fHz duty=%.2f | Vc %.1f->%.1f dV=%.2f | Ion=%.1fA | R=%.1fohm | P=%.0fW %s\n",
               (double)f,(double)duty,(double)vb,(double)va,(double)dv,(double)Ion,(double)R,(double)P,
               dv<0.5f? "(sin descarga)" : "");
}

// PALPADOR: rafaga GENTIL (duty bajo) solo para SENSAR contacto/altura via R.
static void medir_contacto(void){
    sleep_ms(3);
    disch_config(disch_f);
    float vb=vcap();
    disch_set_duty(0.15f);
    busy_wait_us(PROBE_US);
    disch_off();
    float va=vcap();
    float dv=vb-va, vavg=(vb+va)*0.5f;
    float Iavg=(dv>0)?(C_HV*dv)/(PROBE_US*1e-6f):0.0f;
    float Ion=Iavg/0.15f;
    float R=(Ion>0)?vavg/Ion:1e9f;
    const char* st = (R<80.0f)   ? "TOCANDO  <<< ESTA es la altura (Z de contacto)" :
                     (R<1500.0f) ? "CERCA (baja un poco mas)" :
                                   "ARRIBA (sin contacto)";
    printf("  ALTURA: R=%8.0f ohm | %s\n",(double)R,st);
}

int main(void){
    stdio_init_all();
    adc_init(); adc_gpio_init(26); adc_gpio_init(27); adc_gpio_init(28);
    gpio_init(25); gpio_set_dir(25,GPIO_OUT);
    gpio_set_function(PIN_BOOST, GPIO_FUNC_PWM);
    sb=pwm_gpio_to_slice_num(PIN_BOOST); cb=pwm_gpio_to_channel(PIN_BOOST);
    pwm_set_wrap(sb, BOOST_WRAP); set_boost(0); pwm_set_enabled(sb, true);
    gpio_set_function(PIN_DISCH, GPIO_FUNC_PWM);
    sd=pwm_gpio_to_slice_num(PIN_DISCH); cd=pwm_gpio_to_channel(PIN_DISCH);
    pwm_set_clkdiv(sd, DISCH_DIV); disch_config(disch_f); disch_off(); pwm_set_enabled(sd, true);
    sleep_ms(1500);
    printf("== FRECUENCIA v4 == g=cargar o=off s=stop f=FREQ c=CONTINUO b=barrido p=pulso z=PALPADOR | 2=2da-onda k/j=f2 | +-(f1) <>(duty)\n");
    printf("   sweet spot f1=%.0fHz duty=%.2f. clamp %.0fV. arranca boost OFF. 🥽\n",(double)disch_f,(double)disch_duty,(double)CLAMP_V);

    int rpt=0; uint32_t np=0; int cont_cnt=0;
    while(true){
        float vc=vcap();
        clamp_check(vc);

        int c=getchar_timeout_us(0);
        if(c=='+'){ disch_f*=1.25f; if(disch_f>250000)disch_f=250000; }
        else if(c=='-'){ disch_f/=1.25f; if(disch_f<100)disch_f=100; }   // permite bajar a 100-200Hz (pulsos largos ~ms)
        else if(c=='>'){ disch_duty+=0.05f; if(disch_duty>0.9f)disch_duty=0.9f; }
        else if(c=='<'){ disch_duty-=0.05f; if(disch_duty<0.05f)disch_duty=0.05f; }
        else if(c=='2'){ dual_on=!dual_on; printf(">> 2DA ONDA %s (f2=%.0fHz, prof=%.2f)\n", dual_on?"ON":"OFF",(double)disch_f2,(double)dual_depth); }
        else if(c=='k'){ disch_f2*=1.25f; if(disch_f2>20000)disch_f2=20000; printf(">> f2=%.0fHz\n",(double)disch_f2); }
        else if(c=='j'){ disch_f2/=1.25f; if(disch_f2<50)disch_f2=50; printf(">> f2=%.0fHz\n",(double)disch_f2); }
        else if(c=='g'){ mode=CHARGE; boost_on=true; boost_duty=0; printf(">> CARGAR (soft a %.0fV)\n",(double)TARGET_V); }
        else if(c=='o'){ mode=STOP; boost_on=false; boost_duty=0; set_boost(0); printf(">> BOOST OFF\n"); }
        else if(c=='s'){ mode=STOP; boost_on=false; disch_off(); set_boost(0); printf(">> STOP\n"); }
        else if(c=='f'){ mode=FREQ;  printf(">> FRECUENCIA f1=%.0fHz duty=%.2f %s\n",(double)disch_f,(double)disch_duty, dual_on?"+2da onda":""); }
        else if(c=='z'){ mode=PROBE; printf(">> PALPADOR de altura (gentil). Baja la varilla despacio; te aviso al TOCAR.\n"); }
        else if(c=='c'){ mode=CONT; cont_cnt=0; printf(">> CONTINUO: boost+descarga JUNTOS a %.0fV. Vigila MOSFETs. rafagas cortas. 🥽\n",(double)CONT_TARGET); }
        else if(c=='b'){ mode=SWEEP; }
        else if(c=='p'){ mode=PULSE; }

        if(mode==STOP){ disch_off(); if(!boost_on) set_boost(0); }
        else if(mode==CHARGE){
            disch_off();
            if(!clamp_check(vc)){
                if(vc<TARGET_V){ boost_on=true; boost_duty+=BOOST_SOFT; if(boost_duty>DUTY_MAX)boost_duty=DUTY_MAX; set_boost(boost_duty); }
                else { boost_duty-=0.005f; if(boost_duty<0)boost_duty=0; set_boost(boost_duty); }
            }
        }
        else if(mode==FREQ){ recargar(TARGET_V); if(vcap()>5.0f) medir_rafaga(disch_f, disch_duty); }
        else if(mode==PROBE){ recargar(TARGET_V*0.7f); if(vcap()>5.0f) medir_contacto(); }
        else if(mode==CONT){
            // boost ON + descarga ON al MISMO tiempo = potencia continua (sin tiempo muerto)
            if(!clamp_check(vc)){
                if(vc < CONT_TARGET){ boost_on=true; boost_duty+=BOOST_SOFT; }
                else { boost_duty-=0.005f; }
                if(boost_duty<0)boost_duty=0; if(boost_duty>DUTY_MAX)boost_duty=DUTY_MAX;
                set_boost(boost_duty);
            }
            disch_config(disch_f);
            disch_set_duty(disch_duty);          // descarga continua (el PWM sigue solo)
            if(++cont_cnt>=15){ cont_cnt=0;      // medicion periodica de potencia (~0.6s)
                set_boost(0);                    // boost off un instante para medir el consumo
                float vb=vcap();
                busy_wait_us(15000);             // 15ms: el cap cae por la descarga
                float va=vcap();
                float dvm=vb-va, vavg=(vb+va)*0.5f;
                float Iavg=(dvm>0)?(C_HV*dvm)/(15000e-6f):0.0f;
                float Idis=(disch_duty>0)?Iavg/disch_duty:0.0f;
                float R=(Idis>0)?vavg/Idis:0.0f;
                float P=0.5f*C_HV*(vb*vb-va*va)/(15000e-6f);
                printf("  CONTINUO f=%.0fHz duty=%.2f | Vcap=%.1fV | I=%.1fA | R=%.1fohm | P=%.0fW %s\n",
                       (double)disch_f,(double)disch_duty,(double)vavg,(double)Iavg,(double)R,(double)P,
                       P>=30.0f? ">>> ZONA DE FUSION <<<" : "");
            }
        }
        else if(mode==SWEEP){
            const float fl[]={1000,2000,4714,9127,20000,50000,100000,200000};
            printf("== BARRIDO R(f) | duty 0.40 | ventana 60ms ==\n");
            bool save=dual_on; dual_on=false;
            for(int i=0;i<8;i++){ recargar(TARGET_V); if(vcap()>5.0f) medir_rafaga(fl[i],0.40f); }
            dual_on=save;
            printf("== fin ==\n");
            mode=STOP; disch_off(); boost_on=false; set_boost(0);
        }
        else if(mode==PULSE){
            disch_off(); sleep_ms(2);
            float va=vcap(); disch_full_on(); busy_wait_us(PULSE_US); disch_off();
            float vd=vcap(); float dv=va-vd;
            float E=0.5f*C_HV*(va*va-vd*vd);
            printf("PULSO #%u | Vc %.1f->%.1f dV=%.2f | E=%.0fmJ\n",
                   (unsigned)np++,(double)va,(double)vd,(double)dv,(double)(E*1000.0f));
            mode=STOP; boost_on=false; set_boost(0);
        }

        gpio_put(25, vc>=TARGET_V*0.9f?1:0);

        if(mode!=FREQ && mode!=SWEEP && mode!=PROBE && mode!=CONT && ++rpt>=5){ rpt=0;
            printf("[%s] boost=%s(%.0f%%) f1=%.0fHz duty=%.2f f2=%.0fHz[%s] | Vcap=%.1fV\n",
                   mode==CHARGE?"CHRG":"STOP", boost_on?"ON ":"OFF",
                   (double)(boost_duty*100.0f),(double)disch_f,(double)disch_duty,
                   (double)disch_f2, dual_on?"ON":"off",(double)vc);
        }
        sleep_ms(40);
    }
}
