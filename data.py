import pandas as pd
import re

# --- CONFIGURATION ---
DATA_1_DIR = "dataset/dataset.csv"  # Spotify Dataset
DATA_2_DIR = "dataset/charts.csv"   # Billboard Dataset

# --- 1. CLEANING FUNCTIONS ---

def clean_song_title(title):
    """
    Removes (feat. X), [ft. X] from song title to match base song.
    Input: "Essence (feat. Justin Bieber & Tems)" -> "Essence"
    """
    if pd.isna(title): return ""
    title = str(title)
    # Remove (feat...), [ft...], (with...) case insensitive
    pattern = r"(?i)\s*[\(\[]\s*(?:feat|ft|featuring|with)\.?\s+.*?[\)\]]"
    clean_title = re.sub(pattern, "", title)
    return clean_title.strip().lower()

def standardize_artist(text):
    """
    Converts separators to 'and' and lowercases.
    Input: "Drake Featuring Future" -> "drake and future"
    """
    if pd.isna(text): return ""
    text = str(text).lower()
    # Replace separators with " and "
    pattern = r"(?i)\s+(?:featuring|feat\.?|ft\.?|with|&)\s+|,\s+|\s+x\s+|;"
    text = re.sub(pattern, " and ", text)
    # Remove extra spaces
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# --- 2. LOAD & PREPARE ---

print("Loading datasets...")
try:
    df_spotify = pd.read_csv(DATA_1_DIR)
    df_billboard = pd.read_csv(DATA_2_DIR)
    
    # Rename columns for clarity
    df_spotify = df_spotify.rename(columns={"track_name": "song_raw", "artists": "artist_raw"})
    df_billboard = df_billboard.rename(columns={"song": "song_raw", "artist": "artist_raw"})
    
    # Drop duplicates early to speed up processing
    # (One row per unique Song+Artist combo)
    df_spotify = df_spotify[['song_raw', 'artist_raw']].drop_duplicates()
    df_billboard_unique = df_billboard[['song_raw', 'artist_raw']].drop_duplicates()
    
except FileNotFoundError:
    print("❌ Error: Files not found. Check your paths.")
    exit()

print("Standardizing names...")

# Apply Cleaning
df_spotify['song_clean'] = df_spotify['song_raw'].apply(clean_song_title)
df_spotify['artist_clean'] = df_spotify['artist_raw'].apply(standardize_artist)

df_billboard_unique['song_clean'] = df_billboard_unique['song_raw'].apply(clean_song_title)
df_billboard_unique['artist_clean'] = df_billboard_unique['artist_raw'].apply(standardize_artist)

# Create a "Join Key" (Song + Artist)
df_spotify['join_key'] = df_spotify['song_clean'] + "|" + df_spotify['artist_clean']
df_billboard_unique['join_key'] = df_billboard_unique['song_clean'] + "|" + df_billboard_unique['artist_clean']

# --- 3. MERGE (FIND MATCHES) ---

print("Merging data...")
matches = pd.merge(df_spotify, df_billboard_unique, on='join_key', how='inner', suffixes=('_sp', '_bb'))

print(f"\n✅ Total Matched Songs: {len(matches)}")

# --- 4. THE MISMATCH DETECTIVE (NEW PART) ---

# Find unmatched Billboard songs
# Logic: Filter Billboard rows where 'join_key' is NOT in the 'matches' dataframe
unmatched_billboard = df_billboard_unique[~df_billboard_unique['join_key'].isin(matches['join_key'])]

print(f"❌ Total Unmatched Billboard Songs: {len(unmatched_billboard)}")

print("\n" + "="*50)
print("🔍 SAMPLE OF UNMATCHED SONGS (Manual Inspection)")
print("="*50)

if not unmatched_billboard.empty:
    # Take a random sample of 20 songs
    sample_size = min(20, len(unmatched_billboard))
    sample = unmatched_billboard.sample(n=sample_size)
    
    # Print them nicely
    for idx, row in sample.iterrows():
        print(f"ORIGINAL:  '{row['song_raw']}' by '{row['artist_raw']}'")
        print(f"CLEANED:   '{row['song_clean']}' by '{row['artist_clean']}'")
        print("-" * 30)
else:
    print("Amazing! Everything matched (0 mismatches).")

# Optional: Save the mismatches to CSV for deeper look
# unmatched_billboard.to_csv("debug_unmatched_billboard.csv", index=False)