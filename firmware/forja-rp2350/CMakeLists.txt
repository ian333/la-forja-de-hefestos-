cmake_minimum_required(VERSION 3.13)
include(pico_sdk_import.cmake)               # copia de $PICO_SDK_PATH/external/
project(forja_control C CXX ASM)
set(PICO_BOARD pico2)                         # RP2350 (Pico 2)
pico_sdk_init()

add_executable(forja_control control.c)
target_link_libraries(forja_control
    pico_stdlib pico_multicore hardware_adc hardware_pwm hardware_gpio)
pico_enable_stdio_usb(forja_control 1)        # consola por USB (debug del gap/R/T)
pico_add_extra_outputs(forja_control)         # genera forja_control.uf2
