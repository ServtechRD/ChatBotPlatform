#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
初始化 NLTK 資料 (safe to run multiple times)
第一次執行會自動下載需要的 tokenizer / tagger
之後執行只會檢查並略過
"""
import nltk
import os

download_dir = "/home/chatbot_platform/nltk_data"
os.makedirs(download_dir, exist_ok=True)

# 需要的套件
pkgs = [
    "punkt",
    "punkt_tab",
    "averaged_perceptron_tagger",
    "averaged_perceptron_tagger_eng",
]

for p in pkgs:
    try:
        # 檢查是否已存在
        nltk.data.find(f"tokenizers/{p}")
        print(f"[OK] {p} already installed.")
    except LookupError:
        try:
            print(f"[DL] Downloading {p} ...")
            nltk.download(p, download_dir=download_dir)
        except Exception as e:
            print(f"[WARN] Failed to download {p}: {e}")

# 設定環境變數
os.environ["NLTK_DATA"] = download_dir
print(f"✅ NLTK_DATA set to {download_dir}")
