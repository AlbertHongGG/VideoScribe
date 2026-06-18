import urllib.request
import zipfile
import json
import sqlite3
import os
import tempfile
import sys

URL = "https://github.com/scriptin/jmdict-simplified/releases/latest/download/jmdict-eng-3.5.0.json.zip"

def build_dict(db_path):
    print(f"Downloading JMdict JSON from {URL} ...")
    with tempfile.TemporaryDirectory() as tmpdir:
        zip_path = os.path.join(tmpdir, "jmdict.zip")
        try:
            # First fetch the real latest url
            latest_url = "https://github.com/scriptin/jmdict-simplified/releases/latest"
            req = urllib.request.Request(latest_url, method="HEAD")
            try:
                resp = urllib.request.urlopen(req)
                real_url = resp.geturl()
            except urllib.error.HTTPError as e:
                real_url = e.url
            version = real_url.split("/")[-1]
            download_url = f"https://github.com/scriptin/jmdict-simplified/releases/download/{version}/jmdict-eng-{version}.json.zip"
            print(f"Latest version is {version}, downloading from {download_url}")
            urllib.request.urlretrieve(download_url, zip_path)
        except Exception as e:
            print(f"Error downloading: {e}")
            sys.exit(1)

        print("Extracting...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(tmpdir)
            json_file = None
            for file in zip_ref.namelist():
                if file.endswith('.json'):
                    json_file = os.path.join(tmpdir, file)
                    break
            
            if not json_file:
                print("No JSON file found in zip")
                sys.exit(1)
            
            print(f"Reading JSON from {json_file}...")
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            print("Creating SQLite database...")
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS entries (
                    id TEXT PRIMARY KEY,
                    kanji TEXT,
                    kana TEXT,
                    glossary TEXT
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS search_kanji (
                    id TEXT,
                    kanji TEXT
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS search_kana (
                    id TEXT,
                    kana TEXT
                )
            ''')

            count = 0
            for entry in data.get('words', []):
                entry_id = entry.get('id')
                
                kanji_list = [k['text'] for k in entry.get('kanji', [])]
                kana_list = [k['text'] for k in entry.get('kana', [])]
                
                gloss_list = []
                for sense in entry.get('sense', []):
                    glosses = [g['text'] for g in sense.get('gloss', [])]
                    gloss_list.append(", ".join(glosses))
                
                kanji_str = json.dumps(kanji_list, ensure_ascii=False)
                kana_str = json.dumps(kana_list, ensure_ascii=False)
                gloss_str = json.dumps(gloss_list, ensure_ascii=False)
                
                cursor.execute('INSERT OR REPLACE INTO entries (id, kanji, kana, glossary) VALUES (?, ?, ?, ?)',
                              (entry_id, kanji_str, kana_str, gloss_str))
                
                for k in kanji_list:
                    cursor.execute('INSERT INTO search_kanji (id, kanji) VALUES (?, ?)', (entry_id, k))
                for k in kana_list:
                    cursor.execute('INSERT INTO search_kana (id, kana) VALUES (?, ?)', (entry_id, k))
                
                count += 1
                if count % 10000 == 0:
                    print(f"Inserted {count} entries...")
            
            cursor.execute('CREATE INDEX idx_search_kanji ON search_kanji (kanji)')
            cursor.execute('CREATE INDEX idx_search_kana ON search_kana (kana)')
            
            conn.commit()
            conn.close()
            print("Database creation complete.")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        db_path = sys.argv[1]
    else:
        db_path = "jmdict.db"
    build_dict(db_path)
