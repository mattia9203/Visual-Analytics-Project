
const margin = { top: 30, right: 10, bottom: 10, left: 0 };

let svg, x, y, foreground, background, centroidPath;
let width, height;
let onBrushCallback = null;
let activeBrushes = new Map(); // Stores active selections
let resetBtn;

// The features to visualize
const features = [
    "danceability", "energy", "loudness", "speechiness", 
    "acousticness", "instrumentalness", "liveness", "valence"
];

export function initPCP(containerId, data, onBrush) {
    onBrushCallback = onBrush;
    
    // 1. Clear previous drawings
    d3.select(containerId).selectAll("*").remove();
    
    const container = d3.select(containerId);
    const rect = container.node().getBoundingClientRect();
    width = rect.width - margin.left - margin.right;
    height = rect.height - margin.top - margin.bottom;

    // --- ADD RESET BUTTON ---
    resetBtn = container.append("button")
        .text("RESET")
        .style("display", "none")       // Hidden by default
        .style("position", "absolute")
        .style("top", "5px")
        .style("right", "10px")
        .style("z-index", "10")
        .style("width", "2vw")          
        .style("height", "1.5vh")       
        .style("font-size", "0.5vw")    
        .style("padding", "0")
        .style("line-height", "1.5vh")  // Center text vertically
        .style("border", "1px solid #ccc")
        .style("background", "white")
        .style("border-radius", "4px")
        .style("cursor", "pointer")
        .style("color", "#333")
        .style("font-weight", "bold")
        .on("mouseover", function() { d3.select(this).style("background", "#f0f0f0").style("color", "red"); })
        .on("mouseout", function() { d3.select(this).style("background", "white").style("color", "#333"); })
        .on("click", resetSelection);   // Click handler

    svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${rect.width} ${rect.height}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 2. Build Scales
    y = {};
    features.forEach(name => {
        y[name] = d3.scaleLinear()
            .domain([0, 100]) // <--- CHANGE: Force all axes to 0-100
            .range([height, 0]);
    });

    x = d3.scalePoint()
        .range([0, width])
        .padding(1)
        .domain(features);

    // 3. Draw Background Lines (Grey Context)
    background = svg.append("g")
        .attr("class", "background")
        .selectAll("path")
        .data(data)
        .enter().append("path")
        .attr("d", pathFunction)
        .style("fill", "none")
        .style("stroke", "#ddd")
        .style("opacity", 0.5);

    // 4. Draw Foreground Lines (Blue Active)
    foreground = svg.append("g")
        .attr("class", "foreground")
        .selectAll("path")
        .data(data)
        .enter().append("path")
        .attr("d", pathFunction)
        .style("fill", "none")
        .style("stroke", "#4682b4") // Steelblue
        .style("opacity", 0.6); // Visible by default

    // 5. Draw Axes
    const axisGroup = svg.selectAll(".dimension")
        .data(features)
        .enter().append("g")
        .attr("class", "dimension")
        .attr("transform", d => `translate(${x(d)})`);

    // Add Axis Lines and Labels
    axisGroup.append("g")
        .each(function(d) { d3.select(this).call(d3.axisLeft(y[d])); })
        .append("text")
        .style("text-anchor", "middle")
        .attr("y", -9)
        .text(d => d)
        .style("fill", "black")
        .style("font-size", "10px")
        .style("font-weight", "bold")
        .style("cursor", "move");

    // 6. ADD BRUSHES (The Filtering Feature)
    const brushWidth = 20;
    
    axisGroup.append("g")
        .attr("class", "brush")
        .each(function(d) {
            d3.select(this).call(
                d3.brushY()
                    .extent([[-brushWidth / 2, 0], [brushWidth / 2, height]])
                    .on("start brush end", (event) => brushed(event, d, data))
            );
        });

    // Placeholder for the Centroid Line (Red Average Line)
    centroidPath = svg.append("path")
        .attr("class", "centroid")
        .style("fill", "none")
        .style("stroke", "red")
        .style("stroke-width", 3)
        .style("opacity", 0)
        .style("stroke-dasharray", "5,5"); 
}

// Helper: Line generator
function pathFunction(d) {
    return d3.line()(features.map(p => [x(p), y[p](d[p])]));
}

function resetSelection() {
    // 1. Clear Brushes Visuals
    // We select all brush groups and invoke the move method with null
    d3.selectAll(".brush").each(function() {
        d3.select(this).call(d3.brushY().move, null);
    });

    // 2. Clear Internal State
    activeBrushes.clear();

    // 3. Hide the Button
    resetBtn.style("display", "none");

    // 4. Reset Line Visuals (Show all)
    foreground.style("display", null);

    // 5. Notify Main.js to reset other charts (pass null)
    if (onBrushCallback) onBrushCallback(null);
}

// --- BRUSHING LOGIC ---
function brushed(event, feature, data) {
    // 1. Update active brushes map
    if (event.selection) {
        activeBrushes.set(feature, event.selection);
    } else {
        activeBrushes.delete(feature);
    }

    // 2. Filter Data
    // A song is selected if it falls inside the brush for EVERY active feature
    // Iterate over all lines to find matches
    const matches = [];
    
    foreground.style("display", function(d) {
        const isMatch = Array.from(activeBrushes.entries()).every(([key, range]) => {
            const val = y[key](d[key]); 
            // Invert y-axis logic for brush check? No, d3 brush gives pixel coordinates.
            // y scale converts value to pixels.
            return val >= range[0] && val <= range[1];
        });
        
        if (isMatch) matches.push(d);
        return isMatch ? null : "none";
    });

    // 3. Send Filtered Data back to main.js (to update t-SNE)
    if (onBrushCallback) {
        if (activeBrushes.size === 0) {
             onBrushCallback(null); // Reset if no brushes
        } else {
             onBrushCallback(matches);
        }
    }
    if (activeBrushes.size > 0) {
        resetBtn.style("display", "block");
    } else {
        resetBtn.style("display", "none");
    }
}

// --- UPDATE FROM EXTERNAL (t-SNE Trigger) ---
export function updatePCP(selectedData) {
    // If t-SNE selects points, we clear local brushes to avoid conflict
    if (activeBrushes.size > 0) {
        // Optional: clear brushes here if you want t-SNE to override
        // d3.selectAll(".brush").call(d3.brushY().move, null);
        // activeBrushes.clear();
        resetBtn.style("display", "none");
    }

    if (!selectedData || selectedData.length === 0) {
        // Reset view
        foreground.style("display", null).style("stroke", "#4682b4").style("opacity", 0.1);
        centroidPath.style("opacity", 0);
        return;
    }

    // Filter lines based on t-SNE selection
    const selectedNames = new Set(selectedData.map(d => d.track_id)); 

    foreground.style("display", d => selectedNames.has(d.track_id) ? null : "none")
              .style("opacity", 0.6)
              .style("stroke", "#4682b4");

    // Compute Centroid (Average Line)
    const centroid = {};
    features.forEach(attr => {
        centroid[attr] = d3.mean(selectedData, d => +d[attr]);
    });

    centroidPath
        .datum(centroid)
        .attr("d", pathFunction)
        .transition().duration(200)
        .style("opacity", 1);
}