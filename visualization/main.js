import { initBubblePlot, updateBubblePlot, highlightBubblePlot } from "./bubbleplot.js";
import { initBoxPlots, updateBoxPlots} from "./boxplot.js";
import { initTSNE, highlightTSNE} from "./tSNE.js"; 
import { initPCP, updatePCP } from "./parallel_coordinates.js";
import { initRankingPlot } from "./rankingplot.js";

const DATA_PATH = "../dataset/final_dataset_kmeans.csv"; 
const RANKING_DATA_PATH = "../dataset/merged_common_songs.csv";
const AUDIO_FEATURES = ["danceability", "energy", "loudness", "speechiness", "acousticness", "instrumentalness", "liveness", "valence", "popularity", "Year", "Sampled_By", "Is_Sample", "Covered_By", "Is_Cover" , "Remixed_By" ,"Is_Remix", "tsne_x", "tsne_y"]; // <--- ADD TSNE COLUMNS HERE

export let globalData = [];

document.addEventListener("DOMContentLoaded", () => {
    loadData();
});

function loadData() {
    // Load BOTH datasets using Promise.all
    Promise.all([
        d3.csv(DATA_PATH),
        d3.csv(RANKING_DATA_PATH)
        ]).then(([data, rankingData]) => {
        globalData = data.map(d => {
            let obj = { ...d };
            // 1. Ensure track_id exists
            if (!obj.track_id) {
                obj.track_id = `song_${index}`; // Generate unique ID if missing
            }
            AUDIO_FEATURES.forEach(ft => {
                if (ft !== "track_genre") obj[ft] = +d[ft] || 0;         // (+) forces the value to be a number (to prevent math errors)
                else obj[ft] = d[ft];
            });
            return obj;
        });

        console.log(`✅ Data Loaded: ${globalData.length} rows`);
        d3.select("#song_counter").text(globalData.length);

        populateDropdowns();
        
        // --- INITIALIZE VISUALIZATIONS ---

        // 1. Bubble Plot
        initBubblePlot("#sub_bubble_container", globalData, (subsetData) => {
            //subset data is the data of the group's bubble we clicked
            const dataToUse = subsetData || globalData;

            const xVal = d3.select("#x-axis-select").property("value");
            const yVal = d3.select("#y-axis-select").property("value");

            updateBoxPlots(dataToUse, xVal, yVal);

            d3.select("#song_counter").text(dataToUse.length);
        });

        // 2. Box Plots
        initBoxPlots("#sub_boxplot_container", globalData); 

        // 3. Parallel Coordinates
        initPCP("#area_pcp", globalData, (pcpFilteredData) => {
            console.log("PCP Filtered:", pcpFilteredData ? pcpFilteredData.length : "All");
            
            // Filter t-SNE
            highlightTSNE(pcpFilteredData);

            // Filter Bubble Plot 
            highlightBubblePlot(pcpFilteredData);

            // Update Counter
            const count = pcpFilteredData ? pcpFilteredData.length : globalData.length;
            d3.select("#song_counter").text(count);

            // Update Boxplots
            const dataToUse = pcpFilteredData || globalData;
            updateBoxPlots(dataToUse, 
                d3.select("#x-axis-select").property("value"), 
                d3.select("#y-axis-select").property("value")
            );
        }); 

        // 3. t-SNE
        initTSNE("#area_tsne", globalData, (brushedData) => {
            console.log("Brushed Songs:", brushedData ? brushedData.length : "None");
            
            // LOGIC FOR TRIGGERED ANALYTICS:
            // If brushedData exists, we will update the other charts to show ONLY these songs
            const dataToUse = brushedData || globalData;
            
            // Filter Bubble Plot
            highlightBubblePlot(brushedData);

            // Update counter
            d3.select("#song_counter").text(dataToUse.length);

            // Update Boxplots dynamically
            updateBoxPlots(dataToUse, 
                d3.select("#x-axis-select").property("value"), 
                d3.select("#y-axis-select").property("value")
            );

            updatePCP(brushedData);
        });
        initRankingPlot("#area_bump", rankingData);
    });
}

// dinamically builds the user interface controls based on our data columns
function populateDropdowns() {
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