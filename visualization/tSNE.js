
const margin = { top: 30, right: 20, bottom: 20, left: 20 };

let svg, xScale, yScale, circles, brushGroup;
let onBrushCallback = null; // Function to call when user selects songs
let totalWidth, totalHeight;

// Tooltip (reused style from bubbleplot)
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", "rgba(255, 255, 255, 0.95)")
    .style("border", "1px solid #333")
    .style("padding", "8px")
    .style("font-size", "12px")
    .style("pointer-events", "none")
    .style("opacity", 0);

export function initTSNE(containerId, data, onBrush) {
    onBrushCallback = onBrush;
    d3.select(containerId).selectAll("*").remove();

    const container = d3.select(containerId);
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
    // Assuming CSV has 'tsne_x' and 'tsne_y' columns
    xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => +d.tsne_x)).nice()
        .range([0, width]);

    yScale = d3.scaleLinear()
        .domain(d3.extent(data, d => +d.tsne_y)).nice()
        .range([height, 0]);

    // Color Scale (Categorical for Genre)
    const genres = Array.from(new Set(data.map(d => d.track_genre))).sort();
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(genres);

    // --- 2. DRAW CIRCLES ---
    circles = svg.selectAll(".tsne-dot")
        .data(data)
        .enter().append("circle")
        .attr("class", "tsne-dot")
        .attr("cx", d => xScale(+d.tsne_x))
        .attr("cy", d => yScale(+d.tsne_y))
        .attr("r", 3)
        .style("fill", d => colorScale(d.track_genre))
        .style("opacity", 0.7)
        .style("stroke", "none");

    // --- 3. TOOLTIPS ---
    circles.on("mouseover", function(event, d) {
        d3.select(this).style("stroke", "#000").style("opacity", 1).attr("r", 5);
        tooltip.transition().style("opacity", 1);
        tooltip.html(`
            <b>${d.track_name}</b><br/>
            <span style="color:#666">${d.artists}</span><br/>
            <i>${d.track_genre}</i>
        `);
    })
    .on("mousemove", function(event) {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 20) + "px");
    })
    .on("mouseout", function() {
        // Only reset style if NOT currently brushed
        // (If brushed, we want to keep non-selected dimmed)
        const isBrushed = d3.brushSelection(brushGroup.node());
        if(!isBrushed) {
            d3.select(this).style("stroke", "none").style("opacity", 0.7).attr("r", 3);
        } else {
             d3.select(this).style("stroke", "none").attr("r", 3);
        }
        tooltip.transition().style("opacity", 0);
    });

    // --- 4. BRUSHING (The "Triggered Analytics" Hook) ---
    const brush = d3.brush()
        .extent([[0, 0], [width, height]])
        .on("start brush end", brushed);

    brushGroup = svg.append("g")
        .attr("class", "brush")
        .call(brush);

    function brushed(event) {
        // If selection is empty (user clicked background), reset
        if (!event.selection) {
            circles.style("opacity", 0.7).style("fill", d => colorScale(d.track_genre));
            if (onBrushCallback) onBrushCallback(null); // Reset filters
            return;
        }

        const [[x0, y0], [x1, y1]] = event.selection;

        // Identify selected data
        const selectedData = [];
        circles.style("opacity", 0.1); // Dim all initially

        circles.filter(d => {
            const cx = xScale(+d.tsne_x);
            const cy = yScale(+d.tsne_y);
            const isSelected = cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
            if (isSelected) selectedData.push(d);
            return isSelected;
        })
        .style("opacity", 1); // Highlight selected

        // Trigger the callback with the subset
        if (onBrushCallback) onBrushCallback(selectedData);
    }
}

// Optional: Helper to highlight points if filtered from other views
export function highlightTSNE(subsetData) {
    if(!subsetData) {
        // Reset
        circles.transition().style("opacity", 0.7);
        return;
    }
    
    const ids = new Set(subsetData.map(d => d.track_id)); // Assuming unique ID
    circles.style("opacity", d => ids.has(d.track_id) ? 1 : 0.1);
}