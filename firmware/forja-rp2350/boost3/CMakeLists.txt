cmake_minimum_required(VERSION 3.13)
# PICO_BOARD/PLATFORM ANTES de project() e include — si no, el build sale rp2040
# (family ID equivocado, picotool lo rechaza "no partition table"). RP2350 = rp2350-arm-s.
set(PICO_BOARD pico2)
set(PICO_PLATFORM rp2350-arm-s)
include(pico_sdk_import.cmake)
project(forja_boost3 C CXX ASM)
pico_sdk_init()
add_executable(forja_boost3 main.c)
target_link_libraries(forja_boost3 pico_stdlib hardware_adc hardware_pwm)
pico_enable_stdio_usb(forja_boost3 1)
pico_enable_stdio_uart(forja_boost3 0)
pico_add_extra_outputs(forja_boost3)
