import pandas as pd
from sklearn.manifold import TSNE
from sklearn.cluster import KMeans
import numpy as np

# 1. LOAD DATA
input_file = "../dataset/final_imputed_data_normalized.csv" 
output_file = "../dataset/final_dataset_kmeans.csv" 

print(f"Loading {input_file}...")
try:
    df = pd.read_csv(input_file)
except FileNotFoundError:
    print(f"❌ Error: File '{input_file}' not found.")
    exit()

# 2. SELECT AUDIO FEATURES
features = [
    "danceability", "energy", "loudness", "speechiness", 
    "acousticness", "instrumentalness", "liveness", "valence"
]

# 3. PREPARE DATA
# Since the data is already normalized to 0-100 in the input file,
# we just handle missing values (if any) and pass it directly to t-SNE.
data_matrix = df[features].fillna(0)

# 4. RUN t-SNE (The "Map")
print("Running t-SNE on pre-normalized data...")
tsne = TSNE(
    n_components=2, 
    perplexity=40, 
    n_iter=1000, 
    random_state=42, 
    init='pca', 
    learning_rate='auto',
    verbose=1
)

# CHANGED: We pass 'data_matrix' directly instead of 'data_scaled'
tsne_results = tsne.fit_transform(data_matrix)

# Add t-SNE coordinates to dataframe
df['tsne_x'] = tsne_results[:, 0]
df['tsne_y'] = tsne_results[:, 1]

# 5. RUN K-MEANS (The "Colors")
# We cluster based on the t-SNE coordinates.
print("Running K-Means Clustering (finding 8 groups)...")

kmeans = KMeans(n_clusters=8, random_state=0, n_init=10)
predicted_clusters = kmeans.fit_predict(tsne_results) 

# Save these new labels
df['cluster_label'] = predicted_clusters

# 6. SAVE
df.to_csv(output_file, index=False)
print(f"✅ Success! Saved data with K-Means clusters to: {output_file}")
print("Column 'cluster_label' now contains values 0-7.")