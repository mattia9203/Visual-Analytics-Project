import pandas as pd
from sklearn.manifold import TSNE
from sklearn.preprocessing import StandardScaler # <--- IMPORTANT IMPORT
import numpy as np

# 1. LOAD DATA
input_file = "../dataset/final_imputed_data_normalized.csv" 
output_file = "../dataset/final_dataset.csv" 

print(f"Loading {input_file}...")
df = pd.read_csv(input_file)

# 2. SELECT FEATURES
# We exclude 'year', 'popularity' to focus purely on "Sound"
features = [
    "danceability", "energy", "loudness", "speechiness", 
    "acousticness", "instrumentalness", "liveness", "valence"
]

# Filter to available columns
available_features = [f for f in features if f in df.columns]
print(f"Using features: {available_features}")

# 3. NORMALIZE DATA (CRITICAL STEP)
# t-SNE fails if one column has big numbers (like Tempo=120) and others are small (Energy=0.5)
data_subset = df[available_features].fillna(0)
scaler = StandardScaler()
data_scaled = scaler.fit_transform(data_subset)

# 4. RUN t-SNE WITH BETTER PARAMETERS
# Perplexity: Try 30, 40, or 50. (Higher = more global clusters)
# Learning rate: 'auto' is usually best.
# Init: 'pca' helps keep structure better than random.
print("Running t-SNE... (this will take longer now, be patient)")

tsne = TSNE(
    n_components=2, 
    perplexity=40,       # <--- Increased from 30 to 40
    n_iter=3000,         # <--- Increased from 1000 to 3000 (gives it time to separate)
    init='pca',          # <--- Use PCA initialization
    learning_rate='auto',
    random_state=42, 
    verbose=1
)

tsne_results = tsne.fit_transform(data_scaled)

# 5. SAVE
df['tsne_x'] = tsne_results[:, 0]
df['tsne_y'] = tsne_results[:, 1]

df.to_csv(output_file, index=False)
print(f"✅ Done! Saved to {output_file}")