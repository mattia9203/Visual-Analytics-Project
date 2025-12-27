import { initBubblePlot, updateBubblePlot } from "./bubbleplot.js";
import { initBoxPlots, updateBoxPlots } from "./boxplot.js";
import { initTSNE, highlightTSNE} from "./tSNE.js"; 
import { initPCP, updatePCP } from "./parallel_coordinates.js";

const DATA_PATH = "../dataset/final_dataset_kmeans.csv"; 
const AUDIO_FEATURES = ["danceability", "energy", "loudness", "speechiness", "acousticness", "instrumentalness", "liveness", "valence", "popularity", "Real_Year", "tsne_x", "tsne_y"]; // <--- ADD TSNE COLUMNS HERE

export let globalData = [];

document.addEventListener("DOMContentLoaded", () => {
    loadData();
});

function loadData() {
    d3.csv(DATA_PATH).then(data => {
        globalData = data.map(d => {
            let obj = { ...d };
            AUDIO_FEATURES.forEach(ft => {
                if (ft !== "track_genre") obj[ft] = +d[ft] || 0;
                else obj[ft] = d[ft];
            });
            return obj;
        });

        console.log(`✅ Data Loaded: ${globalData.length} rows`);
        d3.select("#song_counter").text(globalData.length);

        populateDropdowns();
        
        // --- INITIALIZE VISUALIZATIONS ---

        // 1. Bubble Plot
        initBubblePlot("#area_bubble", globalData, (subsetData) => {
            // Logic when Bubble is clicked (Filter t-SNE?)
            const dataToUse = subsetData || globalData;

            const xVal = d3.select("#x-axis-select").property("value");
            const yVal = d3.select("#y-axis-select").property("value");

            updateBoxPlots(dataToUse, xVal, yVal);

            // Note: You can also update counters here
            d3.select("#song_counter").text(dataToUse.length);
        });

        // 2. Box Plots
        initBoxPlots("#area_boxplot", globalData); 

        // 3. Parallel Coordinates (Updated Init)
        // Now we pass a callback function as the 3rd argument
        initPCP("#area_pcp", globalData, (pcpFilteredData) => {
            console.log("PCP Filtered:", pcpFilteredData ? pcpFilteredData.length : "All");
            
            // 1. Filter t-SNE
            highlightTSNE(pcpFilteredData);

            // 2. Update Counter
            const count = pcpFilteredData ? pcpFilteredData.length : globalData.length;
            d3.select("#song_counter").text(count);

            // 3. Update Boxplots
            const dataToUse = pcpFilteredData || globalData;
            updateBoxPlots(dataToUse, 
                d3.select("#x-axis-select").property("value"), 
                d3.select("#y-axis-select").property("value")
            );
        }); 

        // 3. t-SNE (New!)
        initTSNE("#area_tsne", globalData, (brushedData) => {
            console.log("Brushed Songs:", brushedData ? brushedData.length : "None");
            
            // LOGIC FOR TRIGGERED ANALYTICS:
            // If brushedData exists, we will update the other charts to show ONLY these songs
            const dataToUse = brushedData || globalData;
            
            // Update counter
            d3.select("#song_counter").text(dataToUse.length);

            // Update Boxplots dynamically
            updateBoxPlots(dataToUse, 
                d3.select("#x-axis-select").property("value"), 
                d3.select("#y-axis-select").property("value")
            );

            // you will call updatePCP(dataToUse) here to calculate the Centroid.
            // --- TRIGGER THE ANALYTIC VIEW ---
            // This satisfies the "Triggered Analytics" requirement
            updatePCP(brushedData);
        });

    });
}

function populateDropdowns() {
    // ... (Keep your existing dropdown code exactly the same) ...
    // Just copy the function from your previous main.js
    const optionsHTML = AUDIO_FEATURES.map(d => 
        `<option value="${d}">${d.replace(/_/g, " ").toUpperCase()}</option>`
    ).join("");
    
    const xSelect = d3.select("#x-axis-select");
    const ySelect = d3.select("#y-axis-select");
    const groupSelect = d3.select("#group-by-select"); 

    xSelect.html(optionsHTML).property("value", "valence");
    ySelect.html(optionsHTML).property("value", "energy");
    groupSelect.html(`<option value="none" selected>None (Individual Songs)</option>` + optionsHTML);

    function onUpdate() {
        updateBubblePlot(
            globalData, 
            xSelect.property("value"), 
            ySelect.property("value"), 
            groupSelect.property("value")
        );
        updateBoxPlots(globalData,
             xSelect.property("value"),
             ySelect.property("value"));
    }

    xSelect.on("change", onUpdate);
    ySelect.on("change", onUpdate);
    groupSelect.on("change", onUpdate);
}