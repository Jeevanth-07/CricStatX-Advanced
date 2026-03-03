import re
import json
import uuid
import os
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import pdfplumber
import tempfile

app = Flask(__name__)
CORS(app)

DB_FILE = "database.json"

# --- LOAD SAVED DATA ---
def load_data():
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r") as f:
                return json.load(f)
        except:
            return {"matches": {}, "players": {}}
    return {"matches": {}, "players": {}}

# Initialize the database
DB = load_data()

# --- SAVE DATA TO DISK ---
def save_data():
    with open(DB_FILE, "w") as f:
        json.dump(DB, f, indent=4)

# --- HOME ROUTE (FIXES 404 ON RENDER) ---
@app.route('/')
def home():
    return jsonify({
        "status": "online",
        "message": "CricStatX API is active!",
        "stats": {
            "matches": len(DB["matches"]),
            "players": len(DB["players"])
        }
    })

# ─── PDF PARSER ───────────────────────────────────────────────────────────────

def parse_cricket_scorecard(pdf_path, filename=""):
    full_text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                full_text += t + "\n"

    lines = [l.strip() for l in full_text.split("\n") if l.strip()]
    lines = [l for l in lines if not re.match(r"^\d+ / \d+$", l) and "TCPDF" not in l]

    result = {
        "id": str(uuid.uuid4()),
        "filename": filename,
        "uploaded_at": datetime.utcnow().isoformat(),
        "match_title": "",
        "result": "",
        "innings": [],
    }

    if not lines:
        raise ValueError("Could not extract text from PDF.")

    result["match_title"] = lines[0]
    result["result"] = lines[1] if len(lines) > 1 else ""

    # Regex patterns
    bat_re   = re.compile(r"^(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)$")
    bowl_re  = re.compile(r"^(.+?)\s+([\d.]+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)$")
    inn_re   = re.compile(r"^(.+?)\s+(\d+)-(\d+)\s+\(([\d.]+)\)$")
    extras_re= re.compile(r"^Extras\s+\((\d+)\)\s+(\d+)\s+B,\s*(\d+)\s+LB,\s*(\d+)\s+WD,\s*(\d+)\s+NB")
    total_re = re.compile(r"^Total\s+(\d+)-(\d+)\s+\(([\d.]+)\)\s+([\d.]+)$")
    fow_re   = re.compile(r"^(.+?)\s+(\d+)/(\d+)\s+([\d.]+)$")

    i = 2
    current_innings = None

    while i < len(lines):
        line = lines[i]
        inn_m = inn_re.match(line)
        if inn_m and i > 0:
            current_innings = {
                "team": inn_m.group(1).strip(),
                "total_runs": int(inn_m.group(2)),
                "total_wickets": int(inn_m.group(3)),
                "score": f"{inn_m.group(2)}-{inn_m.group(3)}",
                "overs": float(inn_m.group(4)),
                "batting": [],
                "bowling": [],
                "fall_of_wickets": [],
                "extras": {},
                "run_rate": 0.0,
            }
            result["innings"].append(current_innings)
            i += 1
            continue

        if line == "Batsman R B 4s 6s SR":
            i += 1
            while i < len(lines):
                bl = lines[i]
                bm = bat_re.match(bl)
                if bm:
                    batsman = {
                        "name":   bm.group(1).strip(),
                        "runs":   int(bm.group(2)),
                        "balls":  int(bm.group(3)),
                        "fours":  int(bm.group(4)),
                        "sixes":  int(bm.group(5)),
                        "sr":     float(bm.group(6)),
                        "how_out": "",
                    }
                    i += 1
                    if i < len(lines):
                        nxt = lines[i]
                        if (not bat_re.match(nxt) and not bowl_re.match(nxt)
                                and not nxt.startswith("Extras") and not nxt.startswith("Total")
                                and not nxt.startswith("Bowler") and not nxt.startswith("Fall")
                                and not inn_re.match(nxt)):
                            batsman["how_out"] = nxt
                            i += 1
                    if current_innings is not None:
                        current_innings["batting"].append(batsman)
                elif extras_re.match(bl):
                    em = extras_re.match(bl)
                    if current_innings is not None:
                        current_innings["extras"] = {
                            "total": int(em.group(1)), "b": int(em.group(2)),
                            "lb": int(em.group(3)), "wd": int(em.group(4)), "nb": int(em.group(5))
                        }
                    i += 1
                elif total_re.match(bl):
                    tm = total_re.match(bl)
                    if current_innings is not None:
                        current_innings["run_rate"] = float(tm.group(4))
                    i += 1
                    break
                else:
                    break
            continue

        if line == "Bowler O M R W ER":
            i += 1
            while i < len(lines):
                bl = lines[i]
                bm = bowl_re.match(bl)
                if bm:
                    bowler = {
                        "name":     bm.group(1).strip(),
                        "overs":    float(bm.group(2)),
                        "maidens":  int(bm.group(3)),
                        "runs":     int(bm.group(4)),
                        "wickets":  int(bm.group(5)),
                        "economy":  float(bm.group(6)),
                    }
                    if current_innings is not None:
                        current_innings["bowling"].append(bowler)
                    i += 1
                else:
                    break
            continue

        if line == "Fall of wickets Score Over":
            i += 1
            while i < len(lines):
                fl = lines[i]
                fm = fow_re.match(fl)
                if fm:
                    if current_innings is not None:
                        current_innings["fall_of_wickets"].append({
                            "batsman": fm.group(1).strip(),
                            "score":   int(fm.group(2)),
                            "wicket":  int(fm.group(3)),
                            "over":    float(fm.group(4)),
                        })
                    i += 1
                else:
                    break
            continue
        i += 1

    return result

# ─── PLAYER AGGREGATION ───────────────────────────────────────────────────────

def aggregate_player_stats(player_name):
    batting = {"matches": 0, "innings": 0, "runs": 0, "balls": 0,
               "fours": 0, "sixes": 0, "not_outs": 0,
               "highest": 0, "fifties": 0, "hundreds": 0}
               
    bowling = {"innings": 0, "overs": 0, "balls": 0, "maidens": 0, "runs": 0,
               "wickets": 0, "best_figures": "0/0", "strike_rate": 0}
    best_bowl = (0, 999)

    for match in DB["matches"].values():
        for inn in match.get("innings", []):
            for b in inn.get("batting", []):
                if b["name"].lower() == player_name.lower():
                    batting["innings"] += 1
                    batting["runs"] += b["runs"]
                    batting["balls"] += b.get("balls", 0)
                    batting["fours"] += b.get("fours", 0)
                    batting["sixes"] += b.get("sixes", 0)
                    if b["runs"] > batting["highest"]:
                        batting["highest"] = b["runs"]
                    if "not out" in b.get("how_out", "").lower():
                        batting["not_outs"] += 1
                    if b["runs"] >= 100:
                        batting["hundreds"] += 1
                    elif b["runs"] >= 50:
                        batting["fifties"] += 1

            for b in inn.get("bowling", []):
                if b["name"].lower() == player_name.lower():
                    bowling["innings"] += 1
                    overs_float = float(b["overs"])
                    full_overs = int(overs_float)
                    balls_in_over = int(round((overs_float - full_overs) * 10))
                    bowling["balls"] += (full_overs * 6) + balls_in_over
                    bowling["maidens"] += b["maidens"]
                    bowling["runs"] += b["runs"]
                    bowling["wickets"] += b["wickets"]
                    if (b["wickets"], -b["runs"]) > (best_bowl[0], -best_bowl[1]):
                        best_bowl = (b["wickets"], b["runs"])

        appeared = any(
            any(b["name"].lower() == player_name.lower() for b in inn.get("batting", []) + inn.get("bowling", []))
            for inn in match.get("innings", [])
        )
        if appeared:
            batting["matches"] += 1

    dism = batting["innings"] - batting["not_outs"]
    batting["average"] = round(batting["runs"] / dism, 2) if dism > 0 else batting["runs"]
    batting["strike_rate"] = round((batting["runs"] / batting["balls"]) * 100, 2) if batting["balls"] > 0 else 0
    
    total_overs = bowling["balls"] // 6
    remaining_balls = bowling["balls"] % 6
    bowling["overs"] = float(f"{total_overs}.{remaining_balls}")
    bowling["strike_rate"] = round(bowling["balls"] / bowling["wickets"], 2) if bowling["wickets"] > 0 else 0
    bowling["best_figures"] = f"{best_bowl[0]}/{best_bowl[1]}"
    bowling["average"] = round(bowling["runs"] / bowling["wickets"], 2) if bowling["wickets"] > 0 else 0
    bowling["economy"] = round(bowling["runs"] / bowling["overs"], 2) if bowling["overs"] > 0 else 0

    return {"batting": batting, "bowling": bowling}


def refresh_all_player_stats():
    all_names = set()
    for match in DB["matches"].values():
        for inn in match.get("innings", []):
            for b in inn.get("batting", []):
                all_names.add(b["name"])
            for b in inn.get("bowling", []):
                all_names.add(b["name"])
                
    DB["players"].clear()
    for name in all_names:
        DB["players"][name] = {
            "name": name,
            **aggregate_player_stats(name)
        }

# ─── ROUTES ───────────────────────────────────────────────────────────────────

@app.route("/api/upload", methods=["POST"])
def upload_pdfs():
    if "files" not in request.files:
        return jsonify({"error": "No files uploaded"}), 400

    files = request.files.getlist("files")
    results = []

    for f in files:
        if not f.filename.lower().endswith(".pdf"):
            results.append({"filename": f.filename, "error": "Not a PDF file"})
            continue

        tmp_dir = tempfile.gettempdir()
        tmp_path = os.path.join(tmp_dir, f"scorecard_{uuid.uuid4()}.pdf")
        
        try:
            f.save(tmp_path)
            match_data = parse_cricket_scorecard(tmp_path, filename=f.filename)
            DB["matches"][match_data["id"]] = match_data
            refresh_all_player_stats()
            results.append({"filename": f.filename, "status": "success"})
        except Exception as e:
            results.append({"filename": f.filename, "error": str(e), "status": "error"})
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    save_data() # Save ONLY on POST
    return jsonify({"uploaded": len([r for r in results if r.get("status") == "success"]), "results": results})

@app.route("/api/reset", methods=["POST", "DELETE"])
def reset_database():
    DB["matches"].clear()
    DB["players"].clear()
    save_data() # Save ONLY on DELETE/POST
    return jsonify({"message": "System completely reset."}), 200

@app.route("/api/matches", methods=["GET"])
def get_matches():
    return jsonify(list(DB["matches"].values()))

@app.route("/api/players", methods=["GET"])
def get_players():
    return jsonify(list(DB["players"].values()))

@app.route("/api/teams", methods=["GET"])
def get_teams():
    teams = set()
    # Search through the database and find all unique team names
    for match in DB["matches"].values():
        for inn in match.get("innings", []):
            if "team" in inn:
                teams.add(inn["team"])
                
    # Format them exactly how React expects them
    return jsonify([{"name": t} for t in teams])

@app.route("/api/stats/leaderboard", methods=["GET"])
def leaderboard():
    players = list(DB["players"].values())
    top_batsmen = sorted([p for p in players if p["batting"]["innings"] > 0], key=lambda x: x["batting"]["runs"], reverse=True)[:10]
    top_bowlers = sorted([p for p in players if p["bowling"]["wickets"] > 0], key=lambda x: x["bowling"]["wickets"], reverse=True)[:10]
    return jsonify({"top_run_scorers": top_batsmen, "top_wicket_takers": top_bowlers})

# --- MERGE PLAYERS ROUTE ---
@app.route("/api/players/merge", methods=["POST"])
def merge_players():
    data = request.json
    source = data.get("source")
    target = data.get("target")

    if not source or not target:
        return jsonify({"error": "Missing source or target player"}), 400

    # Search every match scorecard and replace the old name with the new name
    for match in DB["matches"].values():
        for inn in match.get("innings", []):
            for b in inn.get("batting", []):
                if b["name"].lower() == source.lower():
                    b["name"] = target
            for b in inn.get("bowling", []):
                if b["name"].lower() == source.lower():
                    b["name"] = target

    # Recalculate the stats (this will naturally delete the old empty player profile)
    refresh_all_player_stats()
    save_data()
    return jsonify({"message": f"Successfully merged {source} into {target}"}), 200


# --- DELETE PLAYER ROUTE ---
@app.route("/api/player/<player_name>", methods=["DELETE"])
def delete_player(player_name):
    # To permanently delete a player, we must erase them from all past scorecards
    for match in DB["matches"].values():
        for inn in match.get("innings", []):
            # Keep everyone EXCEPT the player being deleted
            inn["batting"] = [b for b in inn.get("batting", []) if b["name"].lower() != player_name.lower()]
            inn["bowling"] = [b for b in inn.get("bowling", []) if b["name"].lower() != player_name.lower()]

    refresh_all_player_stats()
    save_data()
    return jsonify({"message": f"Player {player_name} permanently deleted."}), 200

# EDITING ROUTES
@app.route("/api/match/<match_id>", methods=["PUT"])
def edit_match(match_id):
    if match_id not in DB["matches"]:
        return jsonify({"error": "Match not found"}), 404

    data = request.json
    match = DB["matches"][match_id]
    
    if "match_title" in data: match["match_title"] = data["match_title"]
    if "result" in data: match["result"] = data["result"]
    if "innings" in data:
        match["innings"] = data["innings"]

    refresh_all_player_stats()
    save_data()
    return jsonify({"message": "Match updated successfully!"}), 200

@app.route("/api/match/<match_id>", methods=["DELETE"])
def delete_match(match_id):
    if match_id in DB["matches"]:
        del DB["matches"][match_id]
        refresh_all_player_stats()
        save_data()
        return jsonify({"message": "Deleted"}), 200
    return jsonify({"error": "Not found"}), 404

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)