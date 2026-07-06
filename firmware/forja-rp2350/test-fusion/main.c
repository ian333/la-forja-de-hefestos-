// FORJA TEST DE FUSION — pulso SOSTENIDO (ms) para CALENTAR/FUNDIR la junta.
// A diferencia del primer-light (56us), aqui dejamos correr la corriente varios
// ms para meter ENERGIA real. Capturamos una TRAZA de I y V a lo largo del pulso
// (R=V/I = termometro TCR) para VER la junta calentarse / fundir / formar cuello.
// SEGURIDAD: tope de corriente, tope de duracion, cooldown largo (enfria el
// MOSFET + recarga los caps). Corriente CALIBRADA (R efectiva 17.8mO incl. el
// ground bounce: lectura cruda 800A == 45A reales).
//
// QUE OBSERVAR:
//   - I rampa (choque) hacia un pico (~descarga LC de los 7mF) y luego DECAE
//     cuando los caps se vacian y manda la fuente.
//   - R = V/I SUBIENDO = la junta se calienta (TCR del acero, +0.45%/C).
//   - Si FUNDE: R cae de golpe (metal liquido). Si forma CUELLO: R se dispara.
//   - Fisico: la punta brilla / funde / se moja / se pega (= tack/deposito).
#include "pico/stdlib.h"
#include "hardware/adc.h"
#include <stdio.h>

#define PIN_GATE     16
#define DIV_RATIO    5.0f
#define R_SHUNT      0.0178f    // calibrado (1mO shunt + ~17mO tierra compartida)

// ---- parametros del pulso de fusion (TUNEABLES) ----
#define PULSE_MS     2400       // ventana de corriente (ms). LED ON = hay corriente = LEVANTA el alambre AHORA.
#define I_LIMIT_A    150.0f     // corte de seguridad de corriente (A reales). Arriba del pico natural (~120A).
#define COOLDOWN_MS  3000       // enfria el MOSFET + recarga los caps entre ventanas (subido por la ventana larga)
#define SETTLE_US    25         // salta el transitorio de conmutacion
#define NMED         7          // mediana anti-ruido por muestra
#define NSAMP        16         // puntos de la traza a lo largo del pulso

static uint16_t adc_median(void){
    uint16_t b[NMED];
    for(int k=0;k<NMED;k++) b[k]=adc_read();
    for(int i=1;i<NMED;i++){ uint16_t v=b[i]; int j=i-1;
        while(j>=0 && b[j]>v){ b[j+1]=b[j]; j--; } b[j+1]=v; }
    return b[NMED/2];
}

int main(void){
    stdio_init_all();
    adc_init(); adc_gpio_init(26); adc_gpio_init(27);
    gpio_init(25); gpio_set_dir(25,GPIO_OUT);
    gpio_init(PIN_GATE); gpio_set_dir(PIN_GATE,GPIO_OUT);
    gpio_put(PIN_GATE,1);                 // MOSFET OFF al arrancar
    sleep_ms(2000);
    printf("== TEST DE FUSION ==  pulso=%dms  I_max=%.0fA  cooldown=%dms\n",
           PULSE_MS, (double)I_LIMIT_A, COOLDOWN_MS);

    uint32_t n=0;
    const uint32_t T_US    = (uint32_t)PULSE_MS*1000u;
    const uint32_t SAMP_DT = T_US/NSAMP;

    while(true){
        // cero de corriente (gate OFF, sin corriente) + V idle
        adc_select_input(1); uint16_t i0=adc_median();
        adc_select_input(0); float v_idle=adc_median()*3.3f/4095.0f*DIV_RATIO;

        float tr_i[NSAMP], tr_v[NSAMP]; uint32_t tr_t[NSAMP]; int ns=0;
        uint32_t next=SAMP_DT;
        float ipk=0, imin=9999.0f, ifirst=-1.0f; int cut_imax=0; uint32_t dur=0;

        gpio_put(25,1);                   // LED ON = HAY CORRIENTE = levanta el alambre AHORA
        gpio_put(PIN_GATE,0);             // MOSFET ON (sostenido)
        busy_wait_us(SETTLE_US);
        absolute_time_t t0=get_absolute_time();
        while(true){
            uint32_t d=(uint32_t)absolute_time_diff_us(t0,get_absolute_time());
            adc_select_input(1); int32_t rel=(int32_t)adc_median()-(int32_t)i0;
            float I=rel*3.3f/4095.0f/R_SHUNT;
            adc_select_input(0); float V=adc_read()*3.3f/4095.0f*DIV_RATIO;
            if(I>ipk) ipk=I; if(I<imin) imin=I; if(ifirst<0.0f) ifirst=I;
            if(d>=next && ns<NSAMP){ tr_t[ns]=d; tr_i[ns]=I; tr_v[ns]=V; ns++; next+=SAMP_DT; }
            if(I>I_LIMIT_A){ cut_imax=1; dur=d; break; }   // seguridad: corriente
            if(d>=T_US){ dur=d; break; }                   // fin normal por ventana
        }
        gpio_put(PIN_GATE,1);             // MOSFET OFF
        gpio_put(25,0);

        // ¿levantaste? la corriente CAE (ruptura/arco) -> imin << ifirst
        int rupture = (ifirst>10.0f && imin < 0.4f*ifirst);
        printf("\nARCO #%u · dur=%uus · I: inicio=%.0fA min=%.0fA pico=%.0fA · %s%s\n",
               (unsigned)n++, (unsigned)dur, (double)ifirst, (double)imin, (double)ipk,
               cut_imax ? "[CORTE I_max] " : "",
               rupture ? ">>> RUPTURA/ARCO (levantaste) <<<" : "(contacto firme)");
        for(int k=0;k<ns;k++){
            float R = tr_i[k]>2.0f ? (tr_v[k]/tr_i[k]*1000.0f) : 0.0f;
            printf("  t=%4.2fms  I=%5.0fA  V=%5.2fV  R=%4.0fmO\n",
                   (double)(tr_t[k]/1000.0f), (double)tr_i[k], (double)tr_v[k], (double)R);
        }
        sleep_ms(COOLDOWN_MS);
    }
}
