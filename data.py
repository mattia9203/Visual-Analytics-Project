import pandas as pd
import re
from thefuzz import fuzz, process
import time

# --- CONFIGURATION ---
DATA_SPOTIFY = "dataset/dataset.csv"
DATA_BILLBOARD = "dataset/charts.csv"
OUTPUT_FILE = "dataset/merged_common_songs.csv"

# --- 1. CLEANING FUNCTIONS ---
def clean_song_title(title):
    if pd.isna(title): return ""
    title = str(title)
    # Remove (feat...), [ft...], (with...)
    pattern = r"(?i)\s*[\(\[]\s*(?:feat|ft|featuring|with)\.?\s+.*?[\)\]]"
    clean = re.sub(pattern, "", title).strip().lower()
    return clean

def standardize_artist(text):
    if pd.isna(text): return ""
    text = str(text).lower()
    # Replace separators with " and "
    pattern = r"(?i)\s+(?:featuring|feat\.?|ft\.?|with|&)\s+|,\s+|\s+x\s+|;"
    text = re.sub(pattern, " and ", text)
    # Remove special chars
    text = re.sub(r"[^a-z0-9\s]", "", text).strip()
    return text

# --- 2. LOAD DATA ---
print(" Loading datasets...")
try:
    df_sp = pd.read_csv(DATA_SPOTIFY)
    df_bb = pd.read_csv(DATA_BILLBOARD)
    
    # Rename Spotify columns
    df_sp = df_sp.rename(columns={"track_name": "sp_song_raw", "artists": "sp_artist_raw"})
    # Rename Billboard columns
    df_bb = df_bb.rename(columns={"song": "bb_song_raw", "artist": "bb_artist_raw"})
    
except FileNotFoundError:
    print("❌ Files not found.")
    exit()

print("🧹 Standardizing Data...")

# Clean Spotify
df_sp['clean_song'] = df_sp['sp_song_raw'].apply(clean_song_title)
df_sp['clean_artist'] = df_sp['sp_artist_raw'].apply(standardize_artist)
df_sp['join_key'] = df_sp['clean_song'] + "|" + df_sp['clean_artist']

# Clean Billboard
df_bb['clean_song'] = df_bb['bb_song_raw'].apply(clean_song_title)
df_bb['clean_artist'] = df_bb['bb_artist_raw'].apply(standardize_artist)
df_bb['join_key'] = df_bb['clean_song'] + "|" + df_bb['clean_artist']

# --- 3. EXACT MATCHING ---
# Map: join_key -> Spotify Row Index (First occurrence)
spotify_lookup = df_sp.drop_duplicates(subset=['join_key']).set_index('join_key')
spotify_keys = set(spotify_lookup.index)

# Find Exact Matches in Billboard
df_bb['spotify_match_id'] = df_bb['join_key'].apply(lambda x: x if x in spotify_keys else None)
exact_count = df_bb['spotify_match_id'].notnull().sum()
print(f" Exact Matches Found (Rows): {exact_count}")

# --- 4. FUZZY MATCHING (RECOVERY) ---
# Filter unique unmatched Billboard songs
unmatched_bb_indices = df_bb[df_bb['spotify_match_id'].isnull()].index
unique_unmatched_bb = df_bb.loc[unmatched_bb_indices].drop_duplicates(subset=['join_key'])

print(f" Fuzzy checking {len(unique_unmatched_bb)} unique unmatched songs...")

# Dictionary for fuzzy lookup (Song Name -> List of potential artists)
spotify_song_map = {}
for idx, row in spotify_lookup.iterrows():
    s_name = row['clean_song']
    if s_name not in spotify_song_map:
        spotify_song_map[s_name] = []
    spotify_song_map[s_name].append(row)

spotify_clean_song_names = list(spotify_song_map.keys())

fuzzy_matches = {}
fuzzy_recovered_count = 0

for idx, row in unique_unmatched_bb.iterrows():
    bb_song = row['clean_song']
    bb_artist = row['clean_artist']
    
    # 1. Fuzzy match song title
    best_match = process.extractOne(bb_song, spotify_clean_song_names, scorer=fuzz.token_sort_ratio)
    
    if best_match:
        matched_song_clean, score = best_match
        
        # 2. Check Score & Artist
        if score >= 85:
            candidates = spotify_song_map[matched_song_clean]
            for cand in candidates:
                sp_artist = cand['clean_artist']
                # Artist Check
                if (bb_artist == sp_artist) or (bb_artist in sp_artist) or (sp_artist in bb_artist):
                    # Match Found -> Map Billboard Key to Spotify Key
                    fuzzy_matches[row['join_key']] = cand.name 
                    fuzzy_recovered_count += 1
                    break 

print(f" Fuzzy Recovered (Unique Songs): {fuzzy_recovered_count}")

# Apply Fuzzy Matches back to Billboard Data
df_bb.loc[df_bb['join_key'].isin(fuzzy_matches.keys()), 'spotify_match_id'] = \
    df_bb['join_key'].map(fuzzy_matches)

# --- 5. FINAL MERGE ---
print("🔗 Merging datasets...")

# Filter Billboard to only rows that have a match
df_bb_matched = df_bb[df_bb['spotify_match_id'].notnull()].copy()

# Merge
merged_df = pd.merge(
    df_bb_matched,
    spotify_lookup,
    left_on='spotify_match_id',
    right_index=True,
    suffixes=('_bb', '_sp')
)

# --- 6. CLEAN UP COLUMNS ---
merged_df = merged_df.rename(columns={
    "sp_song_raw": "track_name", 
    "sp_artist_raw": "artists"
})

# Drop unnecessary columns
cols_to_drop = [
    'bb_song_raw', 'bb_artist_raw', 
    'clean_song_bb', 'clean_artist_bb', 
    'clean_song_sp', 'clean_artist_sp',
    'join_key_bb', 'join_key_sp',
    'spotify_match_id'
]
merged_df = merged_df.drop(columns=[c for c in cols_to_drop if c in merged_df.columns])

# --- 7. EXPORT & STATS ---
print(f" Saving to {OUTPUT_FILE}...")
merged_df.to_csv(OUTPUT_FILE, index=False)

# Calculate Unique Pairs
unique_pairs_count = merged_df[['track_name', 'artists']].drop_duplicates().shape[0]

print("\n" + "="*40)
print(" FINAL STATISTICS")
print("="*40)
print(f"Total Rows (Common Entries):     {len(merged_df)}")
print(f"Unique Artist+Song Pairs Found:  {unique_pairs_count}")
print("="*40)

