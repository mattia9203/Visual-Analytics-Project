import pandas as pd
from sklearn.manifold import TSNE
from sklearn.preprocessing import StandardScaler, MinMaxScaler
import numpy as np

# 1. LOAD DATA
input_file = "../dataset/final_imputed_data_normalized.csv" 
output_file = "../dataset/final_dataset.csv" 

print(f"Loading {input_file}...")
df = pd.read_csv(input_file)

# 2. SELECT FEATURES
features = [
    "danceability", "energy", "loudness", "speechiness", 
    "acousticness", "instrumentalness", "liveness", "valence"
]

available_features = [f for f in features if f in df.columns]
print(f"Using features: {available_features}")

# 3. NORMALIZE DATA 
# We use MinMaxScaler this time to ensure all values are strictly between 0 and 1
# This helps 'cosine' metric work better.
data_subset = df[available_features].fillna(0)
scaler = MinMaxScaler()
data_scaled = scaler.fit_transform(data_subset)

# 4. RUN AGGRESSIVE t-SNE
print("Running Aggressive t-SNE... (this creates stronger separation)")

tsne = TSNE(
    n_components=2, 
    perplexity=20,         # <--- Lowered to 20 (finds smaller local groups)
    n_iter=4000,           # <--- High iterations to let it settle
    early_exaggeration=50, # <--- CRITICAL: Forces clusters to move far apart (Default is 12)
    metric='cosine',       # <--- CRITICAL: 'Cosine' often works better for audio similarity
    init='pca',            
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