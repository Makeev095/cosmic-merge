#!/bin/sh
# ad_build.sh <v|h> <out.mp4>
cd /tmp/promo
K=$1; OUT=$2
STARTS="2.4 8.2 11.0 13.9"; ENDS="8.0 10.4 13.4 15.2"
if [ "$K" = "v" ]; then W=1080; H=1920; BASE="[0:v]null[b0]"; else W=1920; H=1080;
BASE="[0:v]split[a][c];[a]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=40:6,eq=brightness=-0.12[bg];[c]scale=-2:1080[fg];[bg][fg]overlay=(W-w)/2:0[b0]"; fi
INP=""; FILT=""; i=0
for S in $STARTS; do
  E=$(echo $ENDS | cut -d' ' -f$((i+2)))
  E=$(echo $ENDS | cut -d' ' -f$((i+1)))
  D=$(echo "$E - $S" | bc -l)
  INP="$INP -loop 1 -framerate 30 -t $D -i ad_ov_${K}_$i.png"
  FO=$(echo "$D - 0.25" | bc -l)
  FILT="$FILT;[$((i+2)):v]format=rgba,fade=t=in:st=0:d=0.25:alpha=1,fade=t=out:st=$FO:d=0.25:alpha=1,setpts=PTS+$S/TB[o$i];[b$i][o$i]overlay=eof_action=pass[b$((i+1))]"
  i=$((i+1))
done
INP="$INP -loop 1 -framerate 30 -t 5.2 -i ec_$K.png"
FILT="$FILT;[b4]fps=30,format=yuv420p,settb=AVTB[g];[6:v]zoompan=z='min(1+0.0007*on,1.1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=30,format=yuv420p,settb=AVTB[e];[g][e]xfade=transition=fade:duration=0.5:offset=14.7[v]"
ffmpeg -y -loglevel error -framerate 30 -i ad_v/f%05d.jpg -i ad_v/audio.wav $INP \
  -filter_complex "${BASE}${FILT}" -map "[v]" -map 1:a -af "afade=t=in:st=0:d=0.3,afade=t=out:st=18.6:d=1.1" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -r 30 -c:a aac -b:a 160k -t 19.7 -movflags +faststart "$OUT"
