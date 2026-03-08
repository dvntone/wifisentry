# Minimal CMakeLists.txt — allows CMake-based CI (MSVC analysis) to configure
# without errors. This project is primarily JavaScript/Android/Kotlin; there are
# no C++ sources to compile. The LANGUAGES NONE declaration prevents CMake from
# looking for a C/C++ toolchain.
cmake_minimum_required(VERSION 3.10)
project(WifiSentry LANGUAGES NONE)
