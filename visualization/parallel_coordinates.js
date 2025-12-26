// pcp.js
const margin = { top: 30, right: 10, bottom: 10, left: 0 };

let svg, x, y, dimensions, path, foreground, background, centroidPath;
let width, height;

// The features we want to visualize in Parallel Coordinates
const features = [
    "danceability", "energy", "loudness", "speechiness", 
    "acousticness", "instrumentalness", "liveness", "valence"
];

export function initPCP(containerId, data) {
    // 1. Clear previous drawings
    d3.select(containerId).selectAll("*").remove();

    const container = d3.select(containerId);
    const rect = container.node().getBoundingClientRect();
    width = rect.width - margin.left - margin.right;
    height = rect.height - margin.top - margin.bottom;

    svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${rect.width} ${rect.height}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 2. Build Scales for each dimension
    // We compute the domain (min, max) for each audio feature separately
    y = {};
    features.forEach(name => {
        y[name] = d3.scaleLinear()
            .domain(d3.extent(data, d => +d[name]))
            .range([height, 0]);
    });

    // Build the X scale to position the axes horizontally
    x = d3.scalePoint()
        .range([0, width])
        .padding(1)
        .domain(features);

    // 3. Draw Background Lines (Grey - Context)
    background = svg.append("g")
        .attr("class", "background")
        .selectAll("path")
        .data(data)
        .enter().append("path")
        .attr("d", pathFunction)
        .style("fill", "none")
        .style("stroke", "#ddd")
        .style("opacity", 0.5);

    // 4. Draw Foreground Lines (Blue - Active Selection)
    foreground = svg.append("g")
        .attr("class", "foreground")
        .selectAll("path")
        .data(data)
        .enter().append("path")
        .attr("d", pathFunction)
        .style("fill", "none")
        .style("stroke", "#4682b4") // Steelblue
        .style("opacity", 0.05); // Start very faint to avoid clutter

    // 5. Draw the Axes
    const axisGroup = svg.selectAll(".dimension")
        .data(features)
        .enter().append("g")
        .attr("class", "dimension")
        .attr("transform", d => `translate(${x(d)})`);

    // Add axis lines and labels
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
    
    // Placeholder for the Centroid Line
    centroidPath = svg.append("path")
        .attr("class", "centroid")
        .style("fill", "none")
        .style("stroke", "red")
        .style("stroke-width", 3)
        .style("opacity", 0)
        .style("stroke-dasharray", "5,5"); 
}

// Helper: The function that takes a data row and returns the SVG path
function pathFunction(d) {
    return d3.line()(features.map(p => [x(p), y[p](d[p])]));
}

// --- TRIGGERED ANALYTICS UPDATE ---
export function updatePCP(selectedData) {
    
    // Case 1: No selection (or selection cleared)
    if (!selectedData || selectedData.length === 0) {
        // Reset view: show all lines faintly
        foreground.style("opacity", 0.05).style("stroke", "#4682b4");
        centroidPath.style("opacity", 0); // Hide centroid
        return;
    }

    // Case 2: Selection Active
    
    // A. Filter visual lines
    // We use a Set for O(1) lookup speed
    const selectedIds = new Set(selectedData.map(d => d.track_id)); // Ensure your CSV has 'track_id'

    foreground.style("opacity", d => selectedIds.has(d.track_id) ? 0.8 : 0.02)
              .style("stroke", d => selectedIds.has(d.track_id) ? "#4682b4" : "#ddd");

    // B. COMPUTE ANALYTICS (The Centroid)
    // This calculates the average of every feature for the selected group
    const centroid = {};
    features.forEach(attr => {
        centroid[attr] = d3.mean(selectedData, d => +d[attr]);
    });

    // C. Draw the Analytic Result
    centroidPath
        .datum(centroid)
        .attr("d", pathFunction)
        .transition().duration(200)
        .style("opacity", 1);
}