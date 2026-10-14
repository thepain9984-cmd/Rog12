#!/bin/sh
# Lightweight POSIX wrapper invoking Gradle or downloading distribution if absent
exec gradle "$@"
