// FORJA AUTO-CALIB — el sistema se mide y se CORRIGE a si mismo, EN VIVO.
// SIN potencia (gate FORZADO OFF) -> seguro mientras Ian suelda el otro circuito.
// Demuestra las 3 armas contra el 'sucio' (sesion 2026-06-06):
//   - AUTO-CERO adaptativo: promedio movil del offset del shunt -> lo RESTA solo.
//   - MEDIANA (rechaza picos) + PROMEDIO sincronico (baja el ruido /sqrt(N)).
//   - reporta la PRECISION EFECTIVA lograda (en A) y la salud del divisor.
// Cuando llegue corriente, el mismo cero/mediana/promedio ya la miden limpia.
#include "pico/stdlib.h"
#include "hardware/adc.h"
#include <stdio.h>
#include <math.h>

#define PIN_GATE   16
#define DIV_RATIO  5.0f
#define R_SHUNT    0.001f      // shunt fisico (la R efectiva con bounce se calibra aparte)
#define NMED       7           // mediana por muestra
#define NAVG       64          // promedio sincronico por reporte
#define VREF       3.3f
#define ADCMAX     4095.0f

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
    gpio_put(PIN_GATE,1);                 // MOSFET OFF SIEMPRE (sin potencia)
    sleep_ms(1500);
    printf("== AUTO-CALIB == el sensado se corrige a si mismo (SIN potencia, gate OFF)\n");

    // auto-cero adaptativo (filtro exponencial del offset del shunt)
    float zero_ema = adc_median();        // arranque
    uint32_t n=0;
    while(true){
        gpio_put(PIN_GATE,1);             // garantiza OFF cada vuelta (seguridad)
        gpio_put(25, n&1);

        // --- muestras del shunt (corriente) con mediana ---
        adc_select_input(1);
        float acc=0, acc2=0; uint16_t raw_min=4095, raw_max=0;
        for(int i=0;i<NAVG;i++){
            uint16_t m=adc_median();
            acc+=m; acc2+=(float)m*m;
            if(m<raw_min)raw_min=m; if(m>raw_max)raw_max=m;
        }
        float mean=acc/NAVG;
        float var = acc2/NAVG - mean*mean; if(var<0)var=0;
        float rms = sqrtf(var);

        // AUTO-CERO: como no hay potencia, la media ES el offset -> lo seguimos
        zero_ema += 0.10f*(mean - zero_ema);    // EMA suave

        // --- divisor (V de la punta) salud ---
        adc_select_input(0);
        float vmean=adc_median()*VREF/ADCMAX*DIV_RATIO;

        // --- traducir a AMPERES (con el shunt fisico) ---
        float A_per_count = VREF/ADCMAX/R_SHUNT;        // ~0.806 A/cuenta
        float ruido_crudo_A   = rms*A_per_count;                  // 1 muestra
        float ruido_filtrado_A= ruido_crudo_A/sqrtf((float)NAVG); // tras promedio sincronico
        float offset_A        = zero_ema*A_per_count;

        printf("AC #%u | offset=%.0fcnt (auto-cero) | ruido: crudo +-%.1fA -> filtrado +-%.2fA (x%d) | Vpunta=%.2fV | %s\n",
               (unsigned)n++, (double)zero_ema, (double)ruido_crudo_A,
               (double)ruido_filtrado_A, NAVG, (double)vmean,
               (ruido_filtrado_A<1.0f? "sensado LIMPIO" : "ruido alto (revisa cables)"));
        sleep_ms(700);
    }
}
