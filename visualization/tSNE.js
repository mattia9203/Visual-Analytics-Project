const margin = { top: 30, right: 20, bottom: 20, left: 20 };

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
    container.select("svg").remove();

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

    const genres = Array.from(new Set(data.map(d => d.track_genre || "Unknown"))).sort();
    colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(genres);

    // --- 2. DRAW CIRCLES ---
    circles = svg.selectAll(".tsne-dot")
        .data(data)
        .enter().append("circle")
        .attr("class", "tsne-dot")
        .attr("cx", d => xScale(+d.tsne_x))
        .attr("cy", d => yScale(+d.tsne_y))
        .attr("r", 3)                 // <--- Change 3 to 2 (smaller dots)
        .style("fill", d => colorScale(d.track_genre || "Unknown"))
        .style("opacity", 0.7)        // <--- Change 0.7 to 0.5 (more transparent)
        .style("stroke", "none");     // <--- Ensure no outline

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

    // --- 4. BRUSHING ---
    const brush = d3.brush()
        .extent([[0, 0], [width, height]])
        .on("start brush end", brushed);

    brushGroup = svg.append("g")
        .attr("class", "brush")
        .call(brush);

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
}

// --- UPDATED HIGHLIGHT FUNCTION (High Contrast Mode) ---
export function highlightTSNE(subsetData) {
    console.log("t-SNE Highlight received:", subsetData ? subsetData.length : "null");

    if (!subsetData || subsetData.length === 0) {
        // RESET: Restore original look
        circles
            .transition().duration(200)
            .style("opacity", 0.6)
            .style("fill", d => colorScale(d.track_genre || "Unknown"))
            .attr("r", 3)
            .style("stroke", "none");
        return;
    }

    const selectedNames = new Set(subsetData.map(d => d.track_name));

    // 1. DIM EVERYTHING TO NEAR INVISIBLE
    circles
        .transition().duration(200)
        .style("opacity", 0.02)       // Almost invisible
        .attr("r", 1)                 // Tiny dots
        .style("fill", "#cccccc")     // Grey
        .style("stroke", "none");

    // 2. FILTER MATCHES
    const matches = circles.filter(d => selectedNames.has(d.track_name));

    // 3. HIGHLIGHT WITH GIANT DOTS
    matches
        .raise() // Pull to front layer
        .transition().duration(200)
        .style("opacity", 1)
        .style("fill", d => colorScale(d.track_genre || "Unknown")) 
        .attr("r", 8)                 // HUGE radius (easy to see)
        .style("stroke", "black")
        .style("stroke-width", 2);
}