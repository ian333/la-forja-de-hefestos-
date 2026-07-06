/* ============================================================================
 * FORJA — control del cabezal de deposición de metal (RP2350 / Pico 2)
 * ----------------------------------------------------------------------------
 * Implementa la física que simulamos en La Forja (scripts/):
 *   • Sensado por CONTACTO (Kelvin): R = V/I de un divisor + shunt, ADC 12-bit.
 *   • Máquina de estados del LATIGAZO: BUSCA→CALIENTA(TCR)→FUNDE→CORTA→SUELTA.
 *   • Medida de DISTANCIA sin sensor: cronometra el puente → gap (gap-servo-z.py).
 *   • SERVO de Z: trimea la altura para mantener el gap mientras la pieza crece.
 *   • ORDEÑO (drop-on-demand): tamaño de gota = A_w·v_f/f_disparo.
 * Núcleo 1 = lazo rápido determinista (~100 kHz). Núcleo 0 = movimiento + el Pi.
 *
 * OJO: las constantes marcadas [BANCO] se miden en el banco (banco-deposicion-
 * metal.tex): R_op (junta fundida), las ganancias del servo, R1/R2/R_sh reales.
 * Esto es el ESQUELETO verificado en estructura; falta tuning en fierro.
 * ========================================================================== */
#include "pico/stdlib.h"
#include "pico/multicore.h"
#include "hardware/adc.h"
#include "hardware/pwm.h"
#include "hardware/gpio.h"
#include <math.h>

/* ---- pines ---- */
#define PIN_ADC_V   26      // ADC0  ← divisor de V de la junta (R1=47k/R2=10k)
#define PIN_ADC_I   27      // ADC1  ← shunt de derivación (2 mΩ)
#define PIN_GATE    16      // → gate driver del MOSFET (KSP2222A, gate en GP16)
#define PIN_Z_STEP  18
#define PIN_Z_DIR   19
#define PIN_FEED_STEP 20    // extrusor (avance de alambre v_f)
#define PIN_FEED_DIR  21

/* ---- calibración del front-end pasivo [BANCO] ---- */
#define VREF       3.3f
#define ADC_MAX    4095.0f
#define DIV_RATIO  5.00f    // (R1+R2)/R2  (R1=4×10k=40k, R2=10k → ÷5)
#define R_SHUNT    0.001f   // Ω  (shunt R001 SMD = 1 mΩ; cambia si pones otro)
#define I_MIN      2.0f     // A  por debajo: circuito abierto → R = ∞

/* ---- física del acero (de los scripts) ---- */
#define ALPHA_R    0.0045f  // TCR (R/R_frío)
#define AW         5.0265e-7f  // área del alambre 0.8 mm  [m²]
#define R_LIQ_MULT 6.0f     // R/R_frío al liquidus (~TCR a 1520°C)
#define NECK_MULT  4.0f     // R > 4·R_min(líquido) = cuello → CORTAR

/* ---- consignas (las manda el Pi por zona; aquí defaults) ---- */
volatile float gap_target_mm = 0.10f;   // CONTACTO si < crítico (~0.19 mm)
volatile float vf_mm_s       = 4.0f;    // avance de alambre
volatile float I_heat        = 80.0f;   // corriente de calentamiento [A]
volatile float vhead_mm_s    = 40.0f;   // velocidad del cabezal (para el lead)

/* ---- estado compartido ---- */
volatile float g_gap_mm = 0, g_R_mOhm = 0, g_T_est = 0;
volatile int   g_drops = 0;
volatile int32_t z_target_steps = 0;    // el servo lo trimea; núcleo 0 lo persigue
#define Z_STEPS_PER_MM 400.0f

/* ---- lectura del front-end pasivo → R, I [de números reales] ---- */
static inline float read_I(void){ adc_select_input(1); float v=adc_read()*VREF/ADC_MAX; return v/R_SHUNT; }
static inline float read_V(void){ adc_select_input(0); float v=adc_read()*VREF/ADC_MAX; return v*DIV_RATIO; }

// Driver KSP2222A es INVERSOR (GPIO bajo = MOSFET prende). on=true → GPIO bajo.
static inline void gate(bool on){ gpio_put(PIN_GATE, !on); }

/* tamaño de gota del ordeño (vuelo) y gap crítico — de genDeposit/contacto-gap */
static float d_ordeno_mm(float f_hz){ float V=AW*(vf_mm_s*1e-3f)/f_hz; return cbrtf(6.0f*V/(float)M_PI)*1e3f; }

/* ============================ NÚCLEO 1: lazo rápido ======================== */
typedef enum { BUSCA, CALIENTA, FUNDE, CORTA } st_t;

static void core1_main(void){
    st_t st = BUSCA;
    float R_cold = 0, R_min = 1e9f;
    uint32_t t_touch = 0;               // marca de tiempo del último toque (para el gap)
    const uint32_t DT_US = 10;          // 100 kHz

    while (true) {
        uint32_t t = time_us_32();
        float I = read_I();
        float R = (I > I_MIN) ? (read_V() / I) : 1e9f;   // R = V/I  (∞ si abierto)
        g_R_mOhm = R * 1e3f;

        switch (st) {
        case BUSCA:                                       // esperando el toque
            gate(false);
            if (R < 0.060f) {                             // R cae a ~contacto → TOCÓ
                R_cold = R; t_touch = t; R_min = 1e9f; st = CALIENTA;
            }
            break;

        case CALIENTA:                                    // I²R; T por TCR
            gate(I < I_heat);                             // bang-bang a I_heat
            g_T_est = 25.0f + (R / R_cold - 1.0f) / ALPHA_R;
            if (R / R_cold > R_LIQ_MULT) { st = FUNDE; R_min = R; }
            break;

        case FUNDE:                                       // líquido; vigila el cuello
            gate(I < I_heat);
            if (R < R_min) R_min = R;                     // base líquida
            if (R > NECK_MULT * R_min) st = CORTA;        // cuello → corta suave
            break;

        case CORTA:                                       // arco baja i → gota limpia
            gate(false);
            if (R > 1.0f) {                               // R→∞ : SOLTÓ la gota
                /* ---- medir la DISTANCIA por el tiempo de puente ---- */
                float t_bridge_s = (t - t_touch) * 1e-6f;
                float Vdrop = AW * (vf_mm_s*1e-3f) * t_bridge_s;        // vol crecido
                g_gap_mm = cbrtf(6.0f*Vdrop/(float)M_PI) * 1e3f;        // gap = d en contacto
                /* ---- SERVO de Z: trimear hacia el gap objetivo ---- */
                float err = g_gap_mm - gap_target_mm;                  // + = muy alto
                z_target_steps += (int32_t)(-0.6f * err * Z_STEPS_PER_MM); // baja si err>0
                g_drops++;
                st = BUSCA;
            }
            break;
        }
        /* mantener el periodo del lazo */
        while (time_us_32() - t < DT_US) tight_loop_contents();
    }
}

/* ===================== NÚCLEO 0: movimiento + el Pi ======================== */
static void z_chase(void){      // persigue z_target_steps (servo lento de Z)
    static int32_t z_now = 0;
    if (z_now < z_target_steps) { gpio_put(PIN_Z_DIR,1); gpio_put(PIN_Z_STEP,1); sleep_us(2); gpio_put(PIN_Z_STEP,0); z_now++; }
    else if (z_now > z_target_steps){ gpio_put(PIN_Z_DIR,0); gpio_put(PIN_Z_STEP,1); sleep_us(2); gpio_put(PIN_Z_STEP,0); z_now--; }
}

int main(void){
    stdio_init_all();
    adc_init(); adc_gpio_init(PIN_ADC_V); adc_gpio_init(PIN_ADC_I);
    gpio_init(PIN_GATE); gpio_set_dir(PIN_GATE, GPIO_OUT);
    gpio_init(PIN_Z_STEP); gpio_set_dir(PIN_Z_STEP, GPIO_OUT);
    gpio_init(PIN_Z_DIR);  gpio_set_dir(PIN_Z_DIR, GPIO_OUT);
    gpio_init(PIN_FEED_STEP); gpio_set_dir(PIN_FEED_STEP, GPIO_OUT);
    gpio_init(PIN_FEED_DIR);  gpio_set_dir(PIN_FEED_DIR, GPIO_OUT);

    multicore_launch_core1(core1_main);     // lazo rápido determinista

    /* avance de alambre v_f → tren de pasos (extrusor) */
    absolute_time_t next_feed = get_absolute_time();
    while (true) {
        z_chase();                          // servo de Z (mantiene el gap)

        /* paso de avance: cadencia = v_f / (mm por paso) */
        float feed_sps = vf_mm_s * Z_STEPS_PER_MM;     // pasos/s del extrusor
        if (absolute_time_diff_us(get_absolute_time(), next_feed) <= 0) {
            gpio_put(PIN_FEED_DIR,1); gpio_put(PIN_FEED_STEP,1); sleep_us(2); gpio_put(PIN_FEED_STEP,0);
            next_feed = delayed_by_us(get_absolute_time(), (uint64_t)(1e6f/feed_sps));
        }
        /* TODO núcleo 0: recibir del Pi (UART/USB) la trayectoria XY, el gap
         * objetivo por zona (contacto/vuelo), Z nominal por capa, y aplicar:
         *   - esclavizado a velocidad: vf = A_objetivo·v_cabezal(t)  (anti-pegote)
         *   - lead balístico en vuelo: disparar en (blanco − v·t_caída)
         * El lazo rápido (núcleo 1) sigue gobernando gota, gap y corte.        */
    }
}
