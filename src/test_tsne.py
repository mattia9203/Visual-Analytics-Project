import pandas as pd
from sklearn.manifold import TSNE
from sklearn.preprocessing import MinMaxScaler
import numpy as np

# 1. LOAD DATA
input_file = "../dataset/final_imputed_data_normalized.csv" 
output_file = "../dataset/test_dataset.csv"

print(f"Loading {input_file}...")
df = pd.read_csv(input_file)

# 2. SELECT 10 DISTINCT GENRES
selected_genres = [
    'pop', 'rock', 'hip-hop', 'dance', 'rock-n-roll', 'alternative', 'indie-pop'
]

print(f"Filtering for 10 genres: {selected_genres}")
df_subset = df[df['track_genre'].isin(selected_genres)].copy()

if len(df_subset) < 50:
    print("Error: Not enough data found. Check genre names.")
    exit()

# 3. FEATURES & NORMALIZATION
features = [
    "danceability", "energy", "loudness", "speechiness", 
    "acousticness", "instrumentalness", "liveness", "valence"
]

data_matrix = df_subset[features].fillna(0)
scaler = MinMaxScaler()
data_scaled = scaler.fit_transform(data_matrix)

# 4. RUN AGGRESSIVE t-SNE
print("Running Aggressive t-SNE (Cosine Metric)...")

tsne = TSNE(
    n_components=2, 
    perplexity=30,          # Standard balance
    early_exaggeration=50,  # <--- CRITICAL: Forces clusters to separate visually
    metric='cosine',        # <--- CRITICAL: Often better for audio features
    n_iter=2000,            # Give it more time to settle
    random_state=42, 
    init='pca', 
    learning_rate='auto',
    verbose=1
)

results = tsne.fit_transform(data_scaled)

# 5. SAVE
df_subset['tsne_x'] = results[:, 0]
df_subset['tsne_y'] = results[:, 1]

df_subset.to_csv(output_file, index=False)
print(f"✅ Done! Saved 'aggressive' map to: {output_file}")