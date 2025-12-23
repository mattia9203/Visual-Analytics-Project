// js/main.js
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { initBubblePlot, updateBubblePlot } from "./bubbleplot.js";

const DATA_PATH = "../dataset/final_imputed_data_normalized.csv"; 
// Attributes available for analysis
const AUDIO_FEATURES = ["danceability", "energy", "loudness", "speechiness", "acousticness", "instrumentalness", "liveness", "valence", "popularity", "Real_Year" ];

export let globalData = [];

document.addEventListener("DOMContentLoaded", () => {
    loadData();
});

function loadData() {
    d3.csv(DATA_PATH).then(data => {
        globalData = data.map(d => {
            let obj = { ...d };
            // Parse numbers safely
            AUDIO_FEATURES.forEach(ft => {
                // Genres are strings, everything else is a number
                if (ft !== "track_genre") obj[ft] = +d[ft] || 0;
                else obj[ft] = d[ft];
            });
            return obj;
        });

        console.log(`✅ Data Loaded: ${globalData.length} rows`);
        d3.select("#song_counter").text(globalData.length);

        populateDropdowns();
        
        // Initialize with defaults
        initBubblePlot("#area_bubble", globalData);

    });
}

function populateDropdowns() {
    // 1. Create Options HTML
    const optionsHTML = AUDIO_FEATURES.map(d => 
        `<option value="${d}">${d.replace(/_/g, " ").toUpperCase()}</option>`
    ).join("");
    
    // 2. Select Dropdowns
    const xSelect = d3.select("#x-axis-select");
    const ySelect = d3.select("#y-axis-select");
    const groupSelect = d3.select("#group-by-select"); // You added this to HTML

    // 3. Fill Dropdowns
    xSelect.html(optionsHTML).property("value", "valence");
    ySelect.html(optionsHTML).property("value", "energy");
    
    // Group By needs a "None" option at the start
    groupSelect.html(`<option value="none" selected>None (Individual Songs)</option>` + optionsHTML);

    // 4. Unified Update Handler
    function onUpdate() {
        updateBubblePlot(
            globalData, 
            xSelect.property("value"), 
            ySelect.property("value"), 
            groupSelect.property("value")
        );
    }

    // 5. Attach Listeners
    xSelect.on("change", onUpdate);
    ySelect.on("change", onUpdate);
    groupSelect.on("change", onUpdate);
}