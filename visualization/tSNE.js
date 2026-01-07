const margin = { top: 30, right: 180, bottom: 20, left: 20 };

let svg, xScale, yScale, circles, brushGroup;
let colorScale; 
let onBrushCallback = null; 
let totalWidth, totalHeight;

const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", "rgba(255, 255, 255, 0.95)")
    .style("border", "1px solid #333")
    .style("padding", "8px")
    .style("font-size", "12px")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("z-index", 1000);

export function initTSNE(containerId, data, onBrush) {
    onBrushCallback = onBrush;
    
    const container = d3.select(containerId);
    d3.select(containerId).selectAll("*").remove();

    const rect = container.node().getBoundingClientRect();
    totalWidth = rect.width;
    totalHeight = rect.height;

    const width = totalWidth - margin.left - margin.right;
    const height = totalHeight - margin.top - margin.bottom;

    svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${totalWidth} ${totalHeight}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // --- 1. SCALES ---
    xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => +d.tsne_x)).nice()
        .range([0, width]);

    yScale = d3.scaleLinear()
        .domain(d3.extent(data, d => +d.tsne_y)).nice()
        .range([height, 0]);

    colorScale = d3.scaleOrdinal(d3.schemeSet2);

    // --- 2. BRUSH ---
    // We add the brush BEFORE the circles so the brush overlay is "behind" the circles.
    const brush = d3.brush()
        .extent([[0, 0], [width, height]])
        .on("start brush end", brushed);

    brushGroup = svg.append("g")
        .attr("class", "brush")
        .call(brush);

    // --- 3. DRAW CIRCLES ---
    circles = svg.selectAll(".tsne-dot")
        .data(data)
        .enter().append("circle")
        .attr("class", "tsne-dot")
        .attr("cx", d => xScale(+d.tsne_x))
        .attr("cy", d => yScale(+d.tsne_y))
        .attr("r", 3)
        .style("fill", d => colorScale(d.cluster_label))
        .style("opacity", 0.7)
        .style("stroke", "none");
    
    // --- 3. TOOLTIPS ---
    circles.on("mouseover", function(event, d) {
        if (d3.select(this).style("opacity") > 0.2) {
             d3.select(this).style("stroke", "#000").attr("r", 6).style("opacity", 1);
        }
        
        tooltip.transition().style("opacity", 1);
        tooltip.html(`
            <b>${d.track_name}</b><br/>
            <span style="color:#666">${d.artists}</span><br/>
            <i>${d.track_genre || "Unknown"}</i>
        `);
    })
    .on("mousemove", function(event) {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 20) + "px");
    })
    .on("mouseout", function() {
        if (d3.select(this).style("stroke") !== "none") {
             d3.select(this).style("stroke", "none").attr("r", 3);
        }
        tooltip.transition().style("opacity", 0);
    });

    
    

    function brushed(event) {
        if (!event.selection) {
            circles.style("opacity", 0.6);
            if (onBrushCallback) onBrushCallback(null); 
            return;
        }

        const [[x0, y0], [x1, y1]] = event.selection;
        const selectedData = [];
        
        circles.style("opacity", 0.1); 

        circles.filter(d => {
            const cx = xScale(+d.tsne_x);
            const cy = yScale(+d.tsne_y);
            const isSelected = cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
            if (isSelected) selectedData.push(d);
            return isSelected;
        })
        .style("opacity", 1)
        .raise();

        if (onBrushCallback) onBrushCallback(selectedData);
    }

    // 4. DEFINE CLUSTER NAMES  
    const clusterNames = {
        0: "Classic Rock & Pop", 
        1: "Euphoric Mainstream Hits",
        2: "Acoustic Pop & Country",
        3: "High-Energy Alternative",
        4: "Energetic Pop/Rock",
        5: "Melancholic Pop",
        6: "Happy Classic Rock & Blues", 
        7: "Retro Dance & Rock"  
    };


    // --- 5. SIDEBAR LEGEND ---

    // A. Configuration
    const legendItemSize = 12;   
    const legendSpacing = 20;    

    // B. Create Container positioned in the Right Margin
    const legendContainer = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width}, 20)`); // Top-Right, outside graph

    

    const legendData = colorScale.domain().sort(d3.ascending);

    // D. Draw Legend Items
    const legendRows = legendContainer.selectAll(".legend-row")
        .data(legendData)
        .enter().append("g")
        .attr("class", "legend-row")
        .attr("transform", (d, i) => `translate(5, ${i * legendSpacing + 5})`);

    // Draw Color Rect
    legendRows.append("rect")
        .attr("width", legendItemSize)
        .attr("height", legendItemSize)
        .attr("fill", d => colorScale(d));

    // Draw Text Label
    legendRows.append("text")
        .attr("x", legendItemSize + 8) 
        .attr("y", legendItemSize - 1)
        .style("font-size", "11px")    
        .style("fill", "#333")
        .style("font-family", "sans-serif")
        .text(d => `${d}: ${clusterNames[d] || "Unknown"}`);
}

// --- UPDATED HIGHLIGHT FUNCTION ---
export function highlightTSNE(subsetData) {
    console.log("t-SNE Highlight received:", subsetData ? subsetData.length : "null");

    if (!subsetData || subsetData.length === 0) {
        // RESET: Restore original look
        circles
            .transition().duration(200)
            .style("opacity", 0.6)
            .style("fill", d => colorScale(d.cluster_label))
            .attr("r", 3)
            .style("stroke", "none");
        return;
    }

    const selectedNames = new Set(subsetData.map(d => d.track_id));

    circles
        .transition().duration(200)
        .style("opacity", 0.02)       
        .attr("r", 1)                 
        .style("fill", "#cccccc")     
        .style("stroke", "none");

    // FILTER MATCHES
    const matches = circles.filter(d => selectedNames.has(d.track_id));

    // HIGHLIGHT WITH GIANT DOTS
    matches
        .raise() 
        .transition().duration(200)
        .style("opacity", 1)
        .style("fill", d => colorScale(d.cluster_label))
        .attr("r", 8)                 
        .style("stroke", "black")
        .style("stroke-width", 2);
}