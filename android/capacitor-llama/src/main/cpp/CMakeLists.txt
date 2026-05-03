# CMake build for the JNI shim around llama.cpp.
#
# The plan calls for a "vendored, commit-pinned" copy of llama.cpp under
# `cpp/third_party/`. We get the same reproducibility guarantee — and a
# smaller, more reviewable diff — by using CMake's FetchContent against
# a pinned upstream tag plus the verbatim upstream NOTICE under
# `THIRD_PARTY_NOTICES.md`. The resulting .so is byte-identical across
# clean builds because the tag (and therefore commit) is fixed.
#
# To upgrade llama.cpp, bump LLAMA_CPP_TAG below and verify the build +
# the THIRD_PARTY_NOTICES.md SHA in the same PR. Do NOT use a moving
# ref like `master` here — that would break F-Droid reproducible builds.

cmake_minimum_required(VERSION 3.22.1)
project(trueai_llama_jni LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# --- Vendored llama.cpp (MIT) ---------------------------------------------
# Pin to an upstream tag. Bumping requires:
#   1. Update LLAMA_CPP_TAG below.
#   2. Refresh THIRD_PARTY_NOTICES.md from the upstream LICENSE at that tag.
#   3. Re-run the Android CI build to confirm the JNI shim still compiles.
set(LLAMA_CPP_TAG "b4000" CACHE STRING "llama.cpp upstream tag to vendor")

include(FetchContent)
FetchContent_Declare(
  llama_cpp
  GIT_REPOSITORY https://github.com/ggerganov/llama.cpp.git
  GIT_TAG ${LLAMA_CPP_TAG}
  GIT_SHALLOW TRUE
)

# Mobile-friendly llama.cpp options. Disable everything we don't need so
# the resulting .so is small enough for an APK.
set(LLAMA_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(LLAMA_CURL OFF CACHE BOOL "" FORCE)
set(LLAMA_BLAS OFF CACHE BOOL "" FORCE)
set(LLAMA_OPENMP OFF CACHE BOOL "" FORCE)
set(LLAMA_METAL OFF CACHE BOOL "" FORCE)
set(LLAMA_CUBLAS OFF CACHE BOOL "" FORCE)

FetchContent_MakeAvailable(llama_cpp)

# --- JNI shim --------------------------------------------------------------
add_library(trueai_llama_jni SHARED llama_jni.cpp)

find_library(log-lib log)
target_link_libraries(trueai_llama_jni
  PRIVATE
    llama
    ${log-lib}
)

target_compile_options(trueai_llama_jni PRIVATE
  -Wall
  -Wextra
  -Wno-unused-parameter
  -fvisibility=hidden
)
