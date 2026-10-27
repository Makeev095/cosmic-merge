#!/bin/sh
# build_video.sh <v|h> <out.mp4>
cd /tmp/promo
K=$1; OUT=$2
STARTS="0 2.4 9 14.5 21"; ENDS="2.4 9 14.5 21 27"
INP=""; FILT=""
if [ "$K" = "v" ]; then BASE="[0:v]pad=1080:1920:0:150:color=0x0B0F12[b0]"; else BASE="[0:v]null[b0]"; fi
i=0
for S in $STARTS; do
  E=$(echo $ENDS | cut -d' ' -f$((i+1)))
  D=$(echo "$E - $S" | bc -l)
  INP="$INP -loop 1 -framerate 30 -t $D -i ov_${K}_$i.png"
  N=$((i+2))
  FO=$(echo "$D - 0.3" | bc -l)
  FILT="$FILT;[$((i+2)):v]format=rgba,fade=t=in:st=0:d=0.3:alpha=1,fade=t=out:st=$FO:d=0.3:alpha=1,setpts=PTS+$S/TB[o$i];[b$i][o$i]overlay=eof_action=pass[b$((i+1))]"
  i=$((i+1))
done
ffmpeg -y -loglevel error -framerate 30 -i vid_$K/f%05d.jpg -i vid_$K/audio.wav $INP \
  -filter_complex "${BASE}${FILT}" -map "[b5]" -map 1:a -af "afade=t=in:st=0:d=0.3,afade=t=out:st=25.8:d=1.2" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -r 30 -c:a aac -b:a 160k -t 27 -movflags +faststart "$OUT"
