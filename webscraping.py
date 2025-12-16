import pandas as pd
import cloudscraper
from bs4 import BeautifulSoup
import re
import time
import random
import os

# ==========================================
# 1. DATASET CONFIGURATION
# ==========================================
INPUT_CSV = 'dataset/charts.csv'              # <--- Your file name
OUTPUT_CSV = 'dataset/charts_whosampled.csv'   # Output file
ARTIST_COL = 'artist'                  # Column name in charts.csv
SONG_COL = 'song'                      # Column name in charts.csv

scraper = cloudscraper.create_scraper()

# ==========================================
# 2. SMART CLEANING FUNCTIONS
# ==========================================

def clean_artist_for_url(artist_name):
    """
    Handles: "Featuring", ",", "&", "x", "()", and "Lil Nas X" edge cases.
    """
    # 1. Handle Parentheses: Remove everything starting from '('
    # Example: "Silk Sonic (Bruno Mars & Anderson .Paak)" -> "Silk Sonic"
    base = str(artist_name).split('(')[0]
    
    # 2. Robust Split Pattern
    # Matches:
    # - [Ff][Ee][Aa][Tt]... : Featuring, Feat, Ft (Case Insensitive)
    # - [Ww][Ii][Tt][Hh]    : With
    # - &                   : Ampersand
    # - x                   : Lower case 'x' (always split)
    # - X                   : Upper case 'X' ONLY if NOT preceded by "Nas" (Protects Lil Nas X)
    # - ,                   : Comma
    
    p_words = r"(?:[Ff][Ee][Aa][Tt](?:[Uu][Rr][Ii][Nn][Gg]|[\.]?)?|[Ff][Tt][\.]?|[Ww][Ii][Tt][Hh])"
    pattern = rf"\s+(?:{p_words}|&|x)\s+|,\s+|(?<!Nas)\s+X\s+"
    
    parts = re.split(pattern, base)
    clean_text = parts[0].strip()
    
    # 3. Handle Special Characters for URL
    # Replace ' with %27
    clean_text = clean_text.replace("'", "%27")
    # Remove other special chars (allow alphanumeric, - and %)
    clean_text = re.sub(r'[^\w\s\-%]', '', clean_text)
    # Replace spaces with dashes
    clean_text = clean_text.replace(' ', '-')
    
    return clean_text

def clean_song_for_url(song_title):
    # Remove (feat. X) content from song title too
    base_song = re.sub(r'\(.*?\)', '', str(song_title))
    base_song = re.sub(r'\[.*?\]', '', base_song)
    
    base_song = base_song.replace("'", "%27")
    clean_text = re.sub(r'[^\w\s\-%]', '', base_song)
    return clean_text.strip().replace(' ', '-')

def get_artist_variations(url_artist):
    """
    Returns [ "Name-Surname", "Surname-Name" ]
    """
    variations = [url_artist]
    parts = url_artist.split('-')
    if len(parts) == 2:
        variations.append(f"{parts[1]}-{parts[0]}")
    return variations

# ==========================================
# 3. SCRAPING ENGINE
# ==========================================

def scrape_whosampled(artist, song):
    url_song = clean_song_for_url(song)
    base_artist_url = clean_artist_for_url(artist)
    
    # Try Normal Name, then Swapped Name
    variations = get_artist_variations(base_artist_url)
    
    for current_artist in variations:
        target_url = f"https://www.whosampled.com/{current_artist}/{url_song}/"
        
        try:
            response = scraper.get(target_url)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                
                data = {
                    "URL_Found": True,
                    "Real_Year": None,
                    "Covered_By_Count": 0,
                    "Is_Cover_Of": 0,
                    "Sampled_By_Count": 0,
                    "Whosampled_URL": target_url
                }
                
                # A. Extract Year (Meta Tag, Link, or Regex)
                label_div = soup.find("div", class_="label-details")
                if label_div:
                    # Strategy 1: Hidden Meta Tag
                    meta_date = label_div.find("meta", itemprop="datePublished")
                    if meta_date:
                        data["Real_Year"] = int(meta_date["content"])
                    # Strategy 2: Link
                    elif label_div.find("a", href=re.compile(r"/year/")):
                        data["Real_Year"] = int(label_div.find("a", href=re.compile(r"/year/")).text.strip())
                    # Strategy 3: Regex in text
                    else:
                        match = re.search(r'\b(19|20)\d{2}\b', label_div.get_text())
                        if match:
                            data["Real_Year"] = int(match.group(0))

                # B. Extract Connections
                headers = soup.find_all("header", class_="sectionHeader")
                for header in headers:
                    title = header.find("h3", class_="section-header-title")
                    if title:
                        text = title.text.strip()
                        count = int(re.search(r'(\d+)', text).group(1)) if re.search(r'(\d+)', text) else 1
                        
                        if "Covered in" in text:
                            data["Covered_By_Count"] = count
                        elif "Cover of" in text:
                            data["Is_Cover_Of"] = 1
                        elif "Sampled in" in text:
                            data["Sampled_By_Count"] = count
                            
                return data # Success
                
            elif response.status_code == 403:
                print("⛔ [403] Blocked. Pausing...")
                time.sleep(60)
                return {"URL_Found": False}
                
        except Exception:
            pass
            
    return {"URL_Found": False}

# ==========================================
# 4. EXECUTION
# ==========================================

# Load your specific dataset
try:
    df = pd.read_csv(INPUT_CSV)
    # Filter for unique songs to save time (Optional)
    # df = df.drop_duplicates(subset=[ARTIST_COL, SONG_COL])
    print(f"📂 Loaded {len(df)} rows from {INPUT_CSV}")
except FileNotFoundError:
    print("❌ charts.csv not found.")
    exit()

results = []

# Resume Logic
if os.path.exists(OUTPUT_CSV):
    print("🔄 Resuming from previous save...")
    results = pd.read_csv(OUTPUT_CSV).to_dict('records')
    processed_ids = {(r[ARTIST_COL], r[SONG_COL]) for r in results}
else:
    processed_ids = set()
    
    unique_songs = df[[ARTIST_COL, SONG_COL]].drop_duplicates()

for index, row in unique_songs.iterrows():
    artist = row[ARTIST_COL]
    song = row[SONG_COL]
    
    if (artist, song) in processed_ids:
        continue
        
    print(f"[{index+1}/{len(df)}] {artist} - {song}")
    
    scraped_data = scrape_whosampled(artist, song)
    
    row_data = row.to_dict()
    row_data.update(scraped_data)
    results.append(row_data)
    processed_ids.add((artist, song))
    
    if scraped_data["URL_Found"]:
        print(f"   ✅ Found! Year: {scraped_data['Real_Year']}")
    else:
        print("   ❌ Not Found")

    # Save every 20 rows
    if len(results) % 20 == 0:
        pd.DataFrame(results).to_csv(OUTPUT_CSV, index=False)
        
    time.sleep(random.uniform(2, 4))

# Final Save
pd.DataFrame(results).to_csv(OUTPUT_CSV, index=False)
print("Done!")