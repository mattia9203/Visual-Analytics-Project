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
INPUT_CSV = 'dataset/merged_common_songs.csv'              
OUTPUT_CSV = 'dataset/charts_whosampled.csv'   
ARTIST_COL = 'artists'
SONG_COL = 'track_name'

# Identities to mimic human browsing behavior
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0"
]

scraper = cloudscraper.create_scraper()
current_wait_limit = 60  
reached_songs_count = 0  

# ==========================================
# 2. SMART CLEANING FUNCTIONS
# ==========================================

def clean_artist_for_url(artist_name):
    #Takes only the first artist and cleans it for the URL.
    # Split by semicolon/comma first, then remove any parentheses
    base = str(artist_name).split(';')[0].split(',')[0].split('(')[0]
    
    # Common featuring keywords
    p_words = r"(?:[Ff][Ee][Aa][Tt](?:[Uu][Rr][Ii][Nn][Gg]|[\.]?)?|[Ff][Tt][\.]?|[Ww][Ii][Tt][Hh])"
    pattern = rf"\s+(?:{p_words}|&|x)\s+|(?<!Nas)\s+X\s+"
    parts = re.split(pattern, base)
    
    clean_text = parts[0].strip().replace("'", "%27")
    clean_text = re.sub(r'[^\w\s\-%]', '', clean_text)
    return clean_text.replace(' ', '-')

def clean_song_for_url(song_title):
    #Deletes all elements within parentheses and cleans for URL, preserving , and :
    title = str(song_title)
    
    # 1. DELETE elements within '()' and '[]' entirely
    title = re.sub(r'\(.*?\)', '', title)
    title = re.sub(r'\[.*?\]', '', title)
    
    # 2. Split by 'feat' if still present outside brackets
    p_words = r"(?:[Ff][Ee][Aa][Tt](?:[Uu][Rr][Ii][Nn][Gg]|[\.]?)?|[Ff][Tt][\.]?|[Ww][Ii][Tt][Hh])"
    title = re.split(rf"\s+(?:{p_words}|&)\s+", title)[0]
    
    # 3. Handle apostrophes and punctuation
    title = title.replace("'", "%27")
    # Updated Regex: Allow letters, numbers, dashes, %, colons, and commas
    clean_text = re.sub(r'[^\w\s\-%:.!?,]', '', title)
    return clean_text.strip().replace(' ', '-')

# ==========================================
# 3. SCRAPING ENGINE
# ==========================================

def scrape_whosampled(artist, song):
    global current_wait_limit, reached_songs_count
    url_song = clean_song_for_url(song)
    base_artist_url = clean_artist_for_url(artist)
    
    # Variations for standard and surname-first name formats
    variations = [base_artist_url]
    parts = base_artist_url.split('-')
    if len(parts) == 2: variations.append(f"{parts[1]}-{parts[0]}")
    
    for current_artist in variations:
        target_url = f"https://www.whosampled.com/{current_artist}/{url_song}/"
        headers = {"User-Agent": random.choice(USER_AGENTS), "Referer": "https://www.google.com/"}
        
        try:
            response = scraper.get(target_url, headers=headers)
            if response.status_code == 200:
                current_wait_limit = 60 
                soup = BeautifulSoup(response.text, 'html.parser')
                
                data = {
                    "URL_Found": True, "Whosampled_URL": target_url, "Real_Year": None, 
                    "Sampled_By_Count": 0, "Is_Sample_Of": 0,
                    "Covered_By_Count": 0, "Is_Cover_Of": 0, 
                    "Remixed_By_Count": 0, "Is_Remix_Of": 0
                }
                
                label_div = soup.find("div", class_="label-details")
                if label_div:
                    meta_date = label_div.find("meta", itemprop="datePublished")
                    if meta_date: data["Real_Year"] = int(meta_date["content"])
                    elif label_div.find("a", href=re.compile(r"/year/")):
                        data["Real_Year"] = int(label_div.find("a", href=re.compile(r"/year/")).text.strip())
                
                if data["Real_Year"]: 
                    reached_songs_count += 1
                else:
                    print (target_url)

                sections = soup.find_all("header", class_="sectionHeader")
                for s in sections:
                    title_tag = s.find("h3", class_="section-header-title")
                    if title_tag:
                        text = title_tag.text.strip().lower()
                        count = int(re.search(r'(\d+)', text).group(1)) if re.search(r'(\d+)', text) else 1
                        if "sampled in" in text: data["Sampled_By_Count"] = count
                        elif "sample of" in text: data["Is_Sample_Of"] = 1
                        elif "covered in" in text: data["Covered_By_Count"] = count
                        elif "cover of" in text: data["Is_Cover_Of"] = 1
                        elif "remixed in" in text: data["Remixed_By_Count"] = count
                        elif "remix of" in text: data["Is_Remix_Of"] = 1
                
                print(f"   📊 Found: Year={data['Real_Year']} | S:{data['Sampled_By_Count']} | C:{data['Covered_By_Count']} | R:{data['Remixed_By_Count']}")
                return data
                
            elif response.status_code == 403:
                print(f"⛔ [403] Blocked. Waiting {current_wait_limit}s...")
                time.sleep(current_wait_limit)
                current_wait_limit *= 2 
                return {"URL_Found": False}
        except Exception as e:
            print(f" Error: {e}")
            
    return {"URL_Found": False}

# ==========================================
# 4. EXECUTION
# ==========================================



try:
    df_raw = pd.read_csv(INPUT_CSV)
    # Check only unique artist+song pairs (the 2624 pairs)
    df_unique = df_raw[[ARTIST_COL, SONG_COL]].drop_duplicates()
    print(f"📂 Processing {len(df_unique)} unique artist+song pairs.")
except FileNotFoundError:
    print(f" Error: {INPUT_CSV} not found.")
    exit()

results = []
processed_ids = set()

if os.path.exists(OUTPUT_CSV):
    print(" Resuming progress...")
    old_df = pd.read_csv(OUTPUT_CSV)
    results = old_df.to_dict('records')
    processed_ids = {(str(r[ARTIST_COL]), str(r[SONG_COL])) for r in results}
    reached_songs_count = old_df['Real_Year'].notnull().sum()

for index, row in df_unique.iterrows():
    artist, song = str(row[ARTIST_COL]), str(row[SONG_COL])
    if (artist, song) in processed_ids: continue
        
    print(f"\n[{len(results)+1}/{len(df_unique)}] {artist} - {song}")
    scraped_data = scrape_whosampled(artist, song)
    
    row_data = row.to_dict()
    row_data.update(scraped_data)
    results.append(row_data)
    processed_ids.add((artist, song))
    
    print(f" Total years founded: {reached_songs_count}")
    
    if len(results) % 10 == 0:
        temp_df = pd.DataFrame(results)
        int_cols = ['Real_Year', 'Sampled_By_Count', 'Is_Sample_Of', 'Covered_By_Count', 'Is_Cover_Of', 'Remixed_By_Count', 'Is_Remix_Of']
        for col in int_cols:
            if col in temp_df.columns: temp_df[col] = temp_df[col].astype('Int64')
        temp_df.to_csv(OUTPUT_CSV, index=False)
    
    time.sleep(random.uniform(9, 15)) # Increased stealth delay

final_df = pd.DataFrame(results)
for col in ['Real_Year', 'Sampled_By_Count', 'Is_Sample_Of', 'Covered_By_Count', 'Is_Cover_Of', 'Remixed_By_Count', 'Is_Remix_Of']:
    if col in final_df.columns: final_df[col] = final_df[col].astype('Int64')
final_df.to_csv(OUTPUT_CSV, index=False)

print(f"\n Finished! Total unique songs with year founded: {reached_songs_count}")


