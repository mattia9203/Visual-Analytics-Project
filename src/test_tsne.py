import pandas as pd
from sklearn.manifold import TSNE
from sklearn.preprocessing import MinMaxScaler
import numpy as np

# 1. LOAD YOUR DATASET
# Make sure this matches your actual CSV filename
input_file = "../dataset/final_imputed_data_normalized.csv" 

print(f"Loading {input_file}...")
try:
    df = pd.read_csv(input_file)
except FileNotFoundError:
    print(f"❌ Error: File '{input_file}' not found. Please check the name.")
    exit()

# 2. FILTER FOR 3 DISTINCT GENRES
# We use 'country', 'dance', and 'hardcore' (90s Hip Hop in your data)
# These represent Acoustic vs Electronic vs Speech-heavy music.
selected_genres = ['country', 'dance', 'hardcore']

print(f"Filtering dataset for genres: {selected_genres}")
df_subset = df[df['track_genre'].isin(selected_genres)].copy()

# Check if we actually found data
if len(df_subset) == 0:
    print("⚠️ Error: No songs found! Check if 'track_genre' column exists or genre names match.")
    print("Available genres in your file:", df['track_genre'].unique()[:10])
    exit()

print(f"✅ Found {len(df_subset)} songs. Preparing t-SNE...")

# 3. SELECT AUDIO FEATURES
features = [
    "danceability", "energy", "loudness", "speechiness", 
    "acousticness", "instrumentalness", "liveness", "valence"
]

# 4. NORMALIZE DATA
# We use MinMaxScaler to keep everything between 0 and 1
data_matrix = df_subset[features].fillna(0)
scaler = MinMaxScaler()
data_scaled = scaler.fit_transform(data_matrix)

# 5. RUN t-SNE
# Perplexity 30 is good for this subset size (~200-500 songs)
tsne = TSNE(
    n_components=2, 
    perplexity=30, 
    n_iter=1000, 
    random_state=42, 
    init='pca', 
    learning_rate='auto',
    verbose=1
)

print("Running t-SNE algorithm...")
results = tsne.fit_transform(data_scaled)

# 6. SAVE RESULTS
df_subset['tsne_x'] = results[:, 0]
df_subset['tsne_y'] = results[:, 1]

output_file = "../dataset/test_dataset.csv"
df_subset.to_csv(output_file, index=False)

print(f"✅ Success! Created '{output_file}'.")
print("Now update your main.js to load this file: const DATA_PATH = '../dataset/test_dataset.csv';")