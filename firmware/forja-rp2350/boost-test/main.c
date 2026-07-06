// FORJA BOOST-TEST — primera prueba del convertidor BOOST (sube V con frecuencia).
// PWM en GP16 (~50kHz) conmuta el MOSFET boost; el choque patea -> carga el cap HV.
// Driver KSP INVERSOR: GPIO bajo = MOSFET ON. Por eso el nivel PWM se invierte.
// SEGURIDAD: rampa SUAVE de duty (sin inrush), objetivo CONSERVADOR ~20V la 1a vez,
// CORTE DURO si V_cap pin > 3.0V (~33V) para proteger el ADC (divisor /11) y piezas.
// DESCARGA (GP15) FORZADA OFF. Reporta V_cap, duty y shunt en vivo.
#include "pico/stdlib.h"
#include "hardware/adc.h"
#include "hardware/pwm.h"
#include "hardware/gpio.h"
#include <stdio.h>

#define PIN_BOOST   16        // PWM -> KSP#1 -> gate boost
#define PIN_DISCH   15        // descarga, FORZADA OFF
#define DIV_RATIO   11.0f     // divisor de V_cap (100k/10k)
#define VREF        3.3f
#define ADCMAX      4095.0f
#define R_SHUNT     0.001f
#define NMED        7

// --- PWM ---
#define PWM_WRAP    3000      // ~50kHz a 150MHz (150e6/3000)
// --- objetivos / limites (TUNEABLES) ---
#define TARGET_VPIN 2.91f     // objetivo V_cap en el PIN (~32V con /11) -- ya funde (Holm + cap-dump)
#define ABS_MAX_VPIN 3.15f    // CORTE DURO (~34.6V): protege el ADC (max 3.3V) y las piezas
#define DUTY_MAX    0.68f     // tope de duty del MOSFET (V_out=V/(1-D); 0.68 -> ~37V max teorico)
#define DUTY_STEP   0.0015f   // paso de rampa por ciclo de control (~50ms) -> subida SUAVE

static uint slice, chan;

static uint16_t med_ch(int ch){
    adc_select_input(ch);
    uint16_t b[NMED];
    for(int k=0;k<NMED;k++) b[k]=adc_read();
    for(int i=1;i<NMED;i++){ uint16_t v=b[i]; int j=i-1;
        while(j>=0 && b[j]>v){ b[j+1]=b[j]; j--; } b[j+1]=v; }
    return b[NMED/2];
}

// aplica el duty del MOSFET respetando el driver INVERSOR (GPIO bajo = MOSFET on)
static void set_duty_mosfet(float d){
    if(d<0)d=0; if(d>DUTY_MAX)d=DUTY_MAX;
    uint16_t level = (uint16_t)((1.0f - d) * PWM_WRAP);   // invertido
    pwm_set_chan_level(slice, chan, level);
}

int main(void){
    stdio_init_all();
    adc_init(); adc_gpio_init(26); adc_gpio_init(27); adc_gpio_init(28);
    // descarga FORZADA OFF (GPIO normal alto = MOSFET off por el inversor)
    gpio_init(PIN_DISCH); gpio_set_dir(PIN_DISCH,GPIO_OUT); gpio_put(PIN_DISCH,1);
    gpio_init(25); gpio_set_dir(25,GPIO_OUT);

    // PWM en GP16, arrancando con duty MOSFET = 0 (MOSFET OFF) antes de habilitar
    gpio_set_function(PIN_BOOST, GPIO_FUNC_PWM);
    slice = pwm_gpio_to_slice_num(PIN_BOOST);
    chan  = pwm_gpio_to_channel(PIN_BOOST);
    pwm_set_wrap(slice, PWM_WRAP);
    set_duty_mosfet(0.0f);                 // MOSFET OFF (level = WRAP)
    pwm_set_enabled(slice, true);
    sleep_ms(1500);
    printf("== BOOST-TEST == objetivo ~%.0fV (pin %.2f), corte duro ~33V. Descarga OFF.\n",
           (double)(TARGET_VPIN*DIV_RATIO), (double)TARGET_VPIN);

    float duty = 0.0f;
    uint32_t n=0;
    while(true){
        gpio_put(PIN_DISCH,1);             // garantiza descarga OFF
        float vpin = med_ch(2)*VREF/ADCMAX;            // V_cap en el pin
        float vcap = vpin*DIV_RATIO;
        float up = med_ch(0), dn = med_ch(1);
        float I = (up-dn)*VREF/ADCMAX/R_SHUNT;

        // --- lazo de control con CORTE DURO ---
        if(vpin > ABS_MAX_VPIN){           // EMERGENCIA: pasa el limite -> apaga el boost
            duty = 0.0f; set_duty_mosfet(0.0f);
            printf("BOOST #%u | Vcap=%.1fV !!! CORTE DURO (>33V) duty->0 !!!\n",(unsigned)n++,(double)vcap);
        } else {
            if(vcap < TARGET_VPIN*DIV_RATIO) duty += DUTY_STEP;   // sube despacio
            else                              duty -= DUTY_STEP;   // mantiene el objetivo
            if(duty<0)duty=0; if(duty>DUTY_MAX)duty=DUTY_MAX;
            set_duty_mosfet(duty);
            printf("BOOST #%u | Vcap=%.2fV (pin %.3f) | duty=%.1f%% | I=%.0fA | %s\n",
                   (unsigned)n++, (double)vcap, (double)vpin, (double)(duty*100.0f), (double)I,
                   (vcap>=TARGET_VPIN*DIV_RATIO-0.5f)?"== OBJETIVO ==":"subiendo...");
        }
        gpio_put(25, n&1);
        sleep_ms(50);                      // lazo ~20 Hz (rampa suave)
    }
}
