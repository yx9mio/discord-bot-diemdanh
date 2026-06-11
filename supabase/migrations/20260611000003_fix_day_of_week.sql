-- Fix day_of_week values: old schema had T2=2, T3=3, ..., CN=1
-- New schema: Mon(T2)=1, Tue(T3)=2, ..., Sat(T7)=6, Sun(CN)=0
-- Migration: subtract 1 from all existing values, wrap 1→0 for CN
UPDATE scheduled_sessions SET day_of_week = day_of_week - 1 WHERE day_of_week >= 2;
UPDATE scheduled_sessions SET day_of_week = 0 WHERE day_of_week = 1;
