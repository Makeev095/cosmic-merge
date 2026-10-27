#!/bin/sh
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  rm -rf $3
  LEVEL=1 node shoot.js $1 $2 video $3 27 > log_$4.txt 2>&1
  W=$(grep WINT log_$4.txt | awk '{print $2}')
  if [ -n "$W" ] && ! grep -q OVER log_$4.txt && [ $(echo "$W >= 9 && $W <= 16" | bc) = 1 ] && grep -q restarted log_$4.txt; then echo "attempt $i OK win=$W" > res_$4.txt; exit 0; fi
  echo "attempt $i win=$W" > res_$4.txt
done
