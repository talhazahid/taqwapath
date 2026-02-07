#!/usr/bin/env bash
set -euo pipefail

base="https://download.quranicaudio.com/quran"
target_root="${1:-audio}"
sets=(
  "abdul_basit_murattal"
  "mishaari_raashid_al_3afaasee"
  "abdulbasit_w_ibrahim_walk_si"
  "mishaari_w_ibrahim_walk_si"
)

for set in "${sets[@]}"; do
  mkdir -p "${target_root}/${set}"
  echo "Downloading ${set}"
  for i in $(seq -w 1 114); do
    file="${i}.mp3"
    dest="${target_root}/${set}/${file}"
    if [[ -f "${dest}" ]]; then
      continue
    fi
    curl -fL --retry 3 --retry-delay 1 -s -o "${dest}" "${base}/${set}/${file}" || {
      rm -f "${dest}"
      echo "Failed: ${set}/${file}"
    }
  done
done

echo "VPS audio download complete."
