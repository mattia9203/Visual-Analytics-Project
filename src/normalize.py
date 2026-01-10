import pandas as pd

# 1. Load the Data
input_file = '../dataset/final_imputed_data.csv'  # Make sure this path is correct
output_file = '../dataset/final_imputed_data_normalized.csv'

df = pd.read_csv(input_file)

# 2. Define 0-1 Columns to Scale
cols_to_scale = [
    'danceability', 
    'energy', 
    'speechiness', 
    'acousticness', 
    'instrumentalness', 
    'liveness', 
    'valence'
]

print(" Normalizing 0-1 columns...")
for col in cols_to_scale:
    # Simple multiplication: 0.5 -> 50.0
    df[col] = df[col] * 100

# 3. Handle 'loudness' (Negative Values)
# Loudness usually ranges from -60dB (quiet) to 0dB (loud).
# We use Min-Max Scaling formula: (X - Min) / (Max - Min) * 100
print(" Normalizing loudness (handling negative values)...")

min_loudness = df['loudness'].min()
max_loudness = df['loudness'].max()

# Avoid division by zero in the rare case min equals max
if max_loudness != min_loudness:
    df['loudness'] = ((df['loudness'] - min_loudness) / (max_loudness - min_loudness)) * 100
else:
    df['loudness'] = 100 # Default if all values are identical

# 4. Save the Result
df.to_csv(output_file, index=False)
