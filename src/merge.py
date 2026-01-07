import pandas as pd

# File containing your scraped WhoSampled data (Year, Counts)
SCRAPED_FILE = '../dataset/merged_common_songs.csv'

# Original Kaggle file containing Audio Features (Energy, Valence, etc.)
FEATURES_FILE = '../dataset/dataset.csv'

# Output file ready for D3.js
OUTPUT_FILE = '../dataset/final_imputed_data.csv' # Overwriting or creating new

# LOAD DATA

print(" Loading datasets...")
df_scraped = pd.read_csv(SCRAPED_FILE)
df_features = pd.read_csv(FEATURES_FILE)

print(f"   Scraped rows: {len(df_scraped)}")
print(f"   Original rows: {len(df_features)}")

# PREPARE FEATURES FOR MERGE
cols_to_add = [
    'track_id', 'artists', 'track_name', 'popularity', 'duration_ms', 
    'danceability', 'energy', 'speechiness', 'acousticness', 
    'instrumentalness', 'loudness', 'liveness', 'valence', 'track_genre'
]

# Filter the features dataset
df_subset = df_features[cols_to_add]

# If 'Drake - Hotline Bling' appears 5 times in merged_common_songs.csv, we only want 1 version 
df_subset = df_subset.drop_duplicates(subset=['artists', 'track_name'])

#  PERFORM MERGE
print(" Merging datasets on (artists + track_name)...")

# We use a 'left' merge to keep exactly the songs we scraped
df_merged = pd.merge(
    df_scraped, 
    df_subset, 
    on=['artists', 'track_name'], 
    how='left'
)

# FINAL CLEANING

# Ensure no columns are duplicated
missing_ids = df_merged['track_id'].isna().sum()
if missing_ids > 0:
    print(f" Warning: {missing_ids} songs did not match and have no Audio Features.")


# Save to CSV
df_merged.to_csv(OUTPUT_FILE, index=False)
