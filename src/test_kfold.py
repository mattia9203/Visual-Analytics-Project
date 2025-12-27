import pandas as pd
from sklearn.manifold import TSNE
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import numpy as np

# 1. LOAD DATA
input_file = "../dataset/final_imputed_data_normalized.csv" 
output_file = "../dataset/final_dataset_kmeans.csv" # New file with cluster labels

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
# We normalize first to ensure t-SNE works fairly
data_matrix = df[features].fillna(0)
scaler = StandardScaler()
data_scaled = scaler.fit_transform(data_matrix)

# 4. RUN t-SNE (The "Map")
print("Running t-SNE...")
tsne = TSNE(
    n_components=2, 
    perplexity=40, 
    n_iter=1000, 
    random_state=42, 
    init='pca', 
    learning_rate='auto',
    verbose=1
)
tsne_results = tsne.fit_transform(data_scaled)

# Add t-SNE coordinates to dataframe
df['tsne_x'] = tsne_results[:, 0]
df['tsne_y'] = tsne_results[:, 1]

# 5. RUN K-MEANS (The "Colors")
# We cluster based on the t-SNE coordinates to ensure the visual groups match the colors.
# Alternatively, you could cluster on 'data_scaled' for high-dimensional accuracy, 
# but clustering on t-SNE often looks cleaner for 2D visualization.
print("Running K-Means Clustering (finding 8 groups)...")

kmeans = KMeans(n_clusters=8, random_state=0, n_init=10)
# predicted_clusters will be numbers: 0, 1, 2, ..., 7
predicted_clusters = kmeans.fit_predict(tsne_results) 

# Save these new labels as a column. 
# We call it 'cluster_label' to distinguish it from the original 'track_genre'.
df['cluster_label'] = predicted_clusters

# 6. SAVE
df.to_csv(output_file, index=False)
print(f"✅ Success! Saved data with K-Means clusters to: {output_file}")
print("Column 'cluster_label' now contains values 0-7.")