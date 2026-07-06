// FORJA GOTA — PRIMERA DEPOSICIÓN. Boost mantiene el cap a ~32V; cada 2s dispara
// un pulso CORTO del MOSFET de descarga (GP15) -> el cap suelta un puñetazo en la
// junta -> si V_junta>=0.55V (Holm) FUNDE -> gota. Cierra el contacto (alambre
// tocando) para que los disparos produzcan gotas.
//
// SEGURIDAD: 3 IRL540N en descarga aguantan ~330A en pulso; arrancamos en ~96A
// (pulso 3us, limitado por la inductancia de cables) con MUCHO margen. Cooldown 2s
// (el boost recarga el cap). La corriente REAL se mide por la CAÍDA de V_cap
// (ΔQ=C·ΔV) -> robusto, no depende de capturar el pico en us. 🥽 USA PROTECCIÓN DE OJOS.
#include "pico/stdlib.h"
#include "hardware/adc.h"
#include "hardware/pwm.h"
#include "hardware/gpio.h"
#include <stdio.h>

#define PIN_BOOST    16
#define PIN_DISCH    15
#define DIV_RATIO    21.0f        // 200k/10k (100k+100k arriba) -> mide hasta ~69V seguro
#define VREF         3.3f
#define ADCMAX       4095.0f
#define R_SHUNT      0.001f
#define C_HV         2200e-6f     // cap del boost
#define NMED         7
#define PWM_WRAP     3000         // ~50kHz
#define TARGET_VPIN  2.00f        // ~42V (objetivo; con /21). Energía ½CV²≈1.9J
#define ABS_MAX_VPIN 2.14f        // corte duro ~45V
#define DUTY_MAX     0.72f        // V_out=V/(1-D): 0.72 -> MÁX FÍSICO ~43V (no puede pasar = protege el MBR de 60V)
#define DUTY_STEP    0.008f       // recarga ~5x mas rapido el cap entre tacks
#define PULSE_US     30000        // <<< 30ms: la alta R del contacto concentra ~10W -> funde el punto
#define PERIOD_CYC   40           // 40 x 50ms = 2s entre disparos (cooldown / recarga)

static uint slice, chan;

static uint16_t med_ch(int ch){
    adc_select_input(ch);
    uint16_t b[NMED];
    for(int k=0;k<NMED;k++) b[k]=adc_read();
    for(int i=1;i<NMED;i++){ uint16_t v=b[i]; int j=i-1;
        while(j>=0 && b[j]>v){ b[j+1]=b[j]; j--; } b[j+1]=v; }
    return b[NMED/2];
}
static float vcap(void){ return med_ch(2)*VREF/ADCMAX*DIV_RATIO; }

static void set_duty(float d){
    if(d<0)d=0; if(d>DUTY_MAX)d=DUTY_MAX;
    pwm_set_chan_level(slice, chan, (uint16_t)((1.0f-d)*PWM_WRAP));   // driver inversor
}

int main(void){
    stdio_init_all();
    adc_init(); adc_gpio_init(26); adc_gpio_init(27); adc_gpio_init(28);
    gpio_init(25); gpio_set_dir(25,GPIO_OUT);
    // descarga: GPIO normal, arranca OFF (alto = MOSFET off por el inversor)
    gpio_init(PIN_DISCH); gpio_set_dir(PIN_DISCH,GPIO_OUT); gpio_put(PIN_DISCH,1);
    // boost: PWM, arranca con duty 0 (MOSFET off)
    gpio_set_function(PIN_BOOST, GPIO_FUNC_PWM);
    slice = pwm_gpio_to_slice_num(PIN_BOOST);
    chan  = pwm_gpio_to_channel(PIN_BOOST);
    pwm_set_wrap(slice, PWM_WRAP);
    set_duty(0.0f);
    pwm_set_enabled(slice, true);
    sleep_ms(1500);
    printf("== GOTA == boost ~32V + pulso descarga %dus cada 2s. CIERRA el contacto. 🥽\n", PULSE_US);

    float duty=0.0f; uint32_t n=0; int cyc=0;
    const float A_per_count = VREF/ADCMAX/R_SHUNT;

    while(true){
        gpio_put(PIN_DISCH,1);                 // descarga OFF (reposo)
        float vc = vcap();

        // --- regulación del boost ---
        if(vc/DIV_RATIO*0 + vc > ABS_MAX_VPIN*DIV_RATIO){ duty=0; set_duty(0); }
        else { if(vc < TARGET_VPIN*DIV_RATIO) duty+=DUTY_STEP; else duty-=DUTY_STEP;
               if(duty<0)duty=0; if(duty>DUTY_MAX)duty=DUTY_MAX; set_duty(duty); }

        // --- cada PERIOD_CYC: DISPARO DE DESCARGA ---
        if(++cyc >= PERIOD_CYC){
            cyc=0;
            float v_antes = vcap();
            gpio_put(PIN_DISCH,0);             // MOSFET descarga ON (pulso completo, SIN abort)
            busy_wait_us(PULSE_US);
            gpio_put(PIN_DISCH,1);             // OFF
            float v_despues = vcap();
            float dV = v_antes - v_despues;
            // corriente REAL promedio por la CAÍDA de V_cap (sin bounce): I = C*dV/t
            float I_real = (dV>0)? (C_HV*dV)/(PULSE_US*1e-6f) : 0.0f;
            float E = 0.5f*C_HV*(v_antes*v_antes - v_despues*v_despues);
            printf("GOTA #%u | Vcap %.1f->%.1fV (cae %.2fV) | I_real=%.0fA | E=%.0fmJ | %s\n",
                   (unsigned)n++, (double)v_antes, (double)v_despues, (double)dV,
                   (double)I_real, (double)(E*1000.0f),
                   (dV>0.3f)? ">>> DESCARGA REAL (energía a la junta) <<<" : "(poca/sin descarga)");
        }
        gpio_put(25, (vc >= 38.0f) ? 1 : 0);   // LED ON = cap LLENO (~42V) -> toca AHORA para tack fuerte
        sleep_ms(50);
    }
}
