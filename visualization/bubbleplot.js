const margin = { top: 20, right: 30, bottom: 40, left: 50 };
const LEGEND_SPACE = 220; // Increased space for the dual legend

let svg, xScale, yScale, xAxis, yAxis, legendGroup;
let circles;
let totalWidth, totalHeight; 
let onBubbleClickCallback = null; // Store the callback function
let selectedBubbleId = null;      // Track which bubble is selected

// Tooltip
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", "rgba(255, 255, 255, 0.95)")
    .style("color", "#333")
    .style("border", "1px solid #333")
    .style("padding", "8px")
    .style("box-shadow", "2px 2px 5px rgba(0,0,0,0.2)")
    .style("border-radius", "0px")
    .style("font-size", "12px")
    .style("pointer-events", "none")
    .style("opacity", 0);

export function initBubblePlot(containerId, data, onClick) {
    onBubbleClickCallback = onClick;
    d3.select(containerId).selectAll("*").remove();

    const container = d3.select(containerId);
    const rect = container.node().getBoundingClientRect();
    
    totalWidth = rect.width;
    totalHeight = rect.height;

    const drawWidth = totalWidth - margin.left - margin.right;
    const drawHeight = totalHeight - margin.top - margin.bottom;

    svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${totalWidth} ${totalHeight}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    xScale = d3.scaleLinear().range([0, drawWidth]);
    yScale = d3.scaleLinear().range([drawHeight, 0]);

    xAxis = svg.append("g").attr("class", "x-axis").attr("transform", `translate(0,${drawHeight})`);
    yAxis = svg.append("g").attr("class", "y-axis");

    legendGroup = svg.append("g")
        .attr("class", "legend-group")
        .style("opacity", 0); 

    updateBubblePlot(data, "valence", "energy", "none");
}

// 2. UPDATE AGGREGATION TO STORE RAW DATA
function getAggregatedData(data, groupBy, xAttr, yAttr) {
    const binFn = (d) => {
        const val = d[groupBy];
        if (typeof val === "string") return val; 
        if (groupBy === "Real_Year") return Math.floor(val / 10) * 10;
        if (groupBy === "popularity") return Math.floor(val / 10) * 10;
        return (Math.floor(val * 10) / 10).toFixed(1); 
    };

    const groups = d3.group(data, binFn);
    return Array.from(groups, ([key, values]) => {
        return {
            id: key,                    
            count: values.length,       
            x: d3.mean(values, d => d[xAttr]), 
            y: d3.mean(values, d => d[yAttr]), 
            groupAttr: groupBy,
            data: values // <--- Store the raw array of songs here
        };
    });
}

function drawLegend(rScale, colorScale, plotData, isNumeric) {
    legendGroup.selectAll("*").remove();
    
    // --- 1. SIZE LEGEND (Left Column) ---
    const maxCount = rScale.domain()[1];
    // Create 5 steps for size: 20%, 40%, 60%, 80%, 100%
    const sizeSteps = [0.2, 0.4, 0.6, 0.8, 1.0].map(p => Math.max(1, Math.round(maxCount * p)));
    
    // Title
    legendGroup.append("text")
        .attr("x", 0)
        .attr("y", 0)
        .text("Song number:") 
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", "#000");

    let currentY = 15;
    sizeSteps.forEach((val) => {
        const r = rScale(val);
        // Draw centered circle
        legendGroup.append("circle")
            .attr("cx", 25) // Center of column
            .attr("cy", currentY + r)
            .attr("r", r)
            .style("fill", "#dcdcdc") // Light grey like image
            .style("stroke", "none");

        // Label below circle
        currentY += (r * 2) + 12; // Move down past circle + padding
        
        // Use ranges for labels if possible, else just value
        // For simplicity matching the image style:
        let label = val; 
        // Logic to create ranges like "1 - 839" based on previous step could be added here
        // For now, simple count value:
        legendGroup.append("text")
            .attr("x", 25)
            .attr("y", currentY - 2) // Just below circle
            .attr("text-anchor", "middle")
            .text(val)
            .style("font-size", "40%")
            .style("fill", "#000");
    });


    // --- 2. COLOR LEGEND ---
    const colX = 85; // Start X position for color column
    
    // Title
    legendGroup.append("text")
        .attr("x", colX)
        .attr("y", 0)
        .text("Grouping range") 
        .style("font-size", "70%")
        .style("font-weight", "bold")
        .style("fill", "#000");

    const boxHeight = 20;
    const boxWidth = 25;
    let colY = 15;

    if (isNumeric) {
        // Create 10 bins for the numeric range
        const domain = colorScale.domain(); // [min, max]
        const min = domain[1]; // Note: we reversed domain earlier for colors
        const max = domain[0];
        const step = (max - min) / 10;

        for (let i = 0; i < 10; i++) {
            const rangeStart = Math.floor(min + (i * step));
            const rangeEnd = Math.floor(min + ((i + 1) * step));
            // Get color for the midpoint of this bin
            const midPoint = (rangeStart + rangeEnd) / 2;
            
            legendGroup.append("rect")
                .attr("x", colX)
                .attr("y", colY)
                .attr("width", boxWidth)
                .attr("height", boxHeight)
                .style("fill", colorScale(midPoint))
                .style("stroke", "#333")
                .style("stroke-width", "1px");

            legendGroup.append("text")
                .attr("x", colX + boxWidth + 5)
                .attr("y", colY + 14)
                .text(`${rangeStart}-${rangeEnd}`)
                .style("font-size", "11px")
                .style("alignment-baseline", "middle");

            colY += boxHeight;
        }
    } else {
        // Categorical (Genres)
        const categories = colorScale.domain();
        categories.forEach((cat) => {
            legendGroup.append("rect")
                .attr("x", colX)
                .attr("y", colY)
                .attr("width", boxWidth)
                .attr("height", boxHeight)
                .style("fill", colorScale(cat))
                .style("stroke", "#333")
                .style("stroke-width", "1px");

            legendGroup.append("text")
                .attr("x", colX + boxWidth + 5)
                .attr("y", colY + 14)
                .text(cat)
                .style("font-size", "11px")
                .style("alignment-baseline", "middle");

            colY += boxHeight;
        });
    }
}

export function updateBubblePlot(data, xAttr, yAttr, groupBy) {
    const t = d3.transition().duration(1000);
    const isGrouped = groupBy !== "none";
    
    // 1. Resize logic
    const currentRightMargin = isGrouped ? (margin.right + LEGEND_SPACE) : margin.right;
    const effectiveWidth = totalWidth - margin.left - currentRightMargin;
    xScale.range([0, effectiveWidth]);
    xAxis.transition(t).call(d3.axisBottom(xScale));
    selectedBubbleId = null
    // Handle Legend Visibility
    if (isGrouped) {
        legendGroup
            .attr("transform", `translate(${effectiveWidth + 60}, 40)`)
            .transition(t)
            .style("opacity", 1);
        d3.select("#song_counter").text(data.length);
    } else {
        legendGroup.transition(t).style("opacity", 0);
        d3.select("#song_counter").text(data.length);
    }

    // 2. Prepare Data
    let plotData = isGrouped ? getAggregatedData(data, groupBy, xAttr, yAttr) : data;

    // 3. COLOR SCALES
    let colorScale;
    let isNumeric = false;

    if (!isGrouped) {
        colorScale = () => "#4682b4"; 
    } else {
        const sampleId = plotData[0].id;
        isNumeric = !isNaN(parseFloat(sampleId));

        if (isNumeric) {
            // Numeric: Light Blue -> Dark Blue gradient
            const domain = d3.extent(plotData, d => +d.id);
            
            colorScale = d3.scaleLinear()
                .domain(domain) // [min, max]
                .range(["#eff3ff", "#084594"]); 
        } else {
            // Categorical: Standard palette
            const categories = plotData.map(d => d.id).sort();
            colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(categories);
        }
    }

    // 4. Update Axes
    const xExtent = d3.extent(plotData, d => isGrouped ? d.x : d[xAttr]);
    const yExtent = d3.extent(plotData, d => isGrouped ? d.y : d[yAttr]);
    xScale.domain(xExtent).nice();
    yScale.domain(yExtent).nice();
    xAxis.transition(t).call(d3.axisBottom(xScale));
    yAxis.transition(t).call(d3.axisLeft(yScale));

    // 5. RADIUS SCALE
    const maxCount = d3.max(plotData, d => isGrouped ? d.count : 0);
    const rScale = d3.scaleSqrt()
        .domain([0, maxCount])
        .range([5, 45]); 

    // Draw Legend
    if (isGrouped) {
        drawLegend(rScale, colorScale, plotData, isNumeric);
    }

    // 6. DRAW CIRCLES
    circles = svg.selectAll(".bubble")
        .data(plotData, d => isGrouped ? d.id : (d.track_id || d.track_name));

    const enter = circles.enter().append("circle")
        .attr("class", "bubble")
        .attr("cx", d => xScale(isGrouped ? d.x : d[xAttr]))
        .attr("cy", d => yScale(isGrouped ? d.y : d[yAttr]))
        .attr("r", 0)
        .style("fill", d => isGrouped ? (isNumeric ? colorScale(+d.id) : colorScale(d.id)) : "#4682b4")
        .style("opacity", 0.9)
        .style("stroke", "#333")
        .style("stroke-width", isGrouped ? 1 : 0.5)
        .style("cursor", "pointer");

    circles.merge(enter).transition(t)
        .attr("cx", d => xScale(isGrouped ? d.x : d[xAttr]))
        .attr("cy", d => yScale(isGrouped ? d.y : d[yAttr]))
        .attr("r", d => isGrouped ? rScale(d.count) : 3) 
        .style("fill", d => isGrouped ? (isNumeric ? colorScale(+d.id) : colorScale(d.id)) : "#4682b4")
        .style("opacity",0.8)
        .style("stroke","#333");

    // NEW CLICK HANDLER
    circles.merge(enter).on("click", function(event, d) {
        if (!isGrouped) return; // Only works for groups

        // Check if this bubble is already selected
        const isSelected = (selectedBubbleId === d.id);

        if (isSelected) {
            // DESELECT: Reset everything
            selectedBubbleId = null;
            d3.selectAll(".bubble").transition().style("opacity", 0.8).style("stroke", "#333");
            
            // Notify main.js to show ALL data
            if (onBubbleClickCallback) onBubbleClickCallback(null); 
        } else {
            // SELECT: Highlight this one, dim others
            selectedBubbleId = d.id;
            
            d3.selectAll(".bubble").transition().style("opacity", 0.2); // Dim all
            d3.select(this).transition().style("opacity", 1).style("stroke", "black").style("stroke-width", 3); // Highlight clicked

            // Notify main.js to show SUBSET data
            // We pass 'd.data' which is the array of songs in this bubble
            if (onBubbleClickCallback) onBubbleClickCallback(d.data);
        }
    });

    circles.exit().transition(t).attr("r", 0).remove();

    // 7. TOOLTIPS
    circles.merge(enter)
        .on("mouseover", function(event, d) {
            d3.select(this).style("stroke", "#000").style("stroke-width", 2);
            tooltip.transition().duration(100).style("opacity", 1);

            let html = "";
            if (isGrouped) {
                // Formatting based on type
                let idDisplay = isNumeric && groupBy === "Real_Year" ? `${d.id}s` : d.id;
                
                html = `<div style="font-weight:bold; border-bottom:1px solid #ccc; margin-bottom:5px; padding-bottom:3px;">
                            ${idDisplay}
                        </div>
                        <div style="display:flex; justify-content:space-between; width:120px;">
                            <span>Songs:</span> <span style="font-weight:bold;">${d.count}</span>
                        </div>
                        <div style="font-size:11px; color:#555; margin-top:5px;">
                            X: ${d.x.toFixed(2)} | Y: ${d.y.toFixed(2)}
                        </div>`;
            } else {
                html = `<div style="font-weight:bold;">${d.track_name}</div>
                        <div style="font-size:11px; color:#555;">${d.artists}</div>`;
            }
            tooltip.html(html);
        })
        .on("mousemove", function(event) {
            tooltip
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).style("stroke", "#333").style("stroke-width", isGrouped ? 1 : 0.5);
            tooltip.transition().duration(200).style("opacity", 0);
        });
}
// bubbleplot.js

export function highlightBubblePlot(subsetData) {
    const circles = d3.selectAll(".bubble");

    // 1. INTERRUPT: Stop any ongoing animations immediately to prevent lag
    circles.interrupt();

    // 2. CHECK: Is this a "Reset" (no selection)?
    if (!subsetData || subsetData.length === 0) {
        circles.transition().duration(200)
            .style("opacity", 0.8)        // Restore default opacity
            .style("stroke", "#333")      // Restore default grey border
            .style("stroke-width", 1);    // <--- FIX: Restore thin border
        return;
    }

    // 3. PREPARE LOOKUP
    const selectedNames = new Set(subsetData.map(d => d.track_name));

    // 4. APPLY STYLES (One pass for performance)
    circles.each(function(d) {
        // Determine if this bubble matches
        let isMatch = false;
        if (d.data) {
            // Grouped Bubble: Check if ANY song inside is selected
            isMatch = d.data.some(song => selectedNames.has(song.track_name));
        } else {
            // Single Bubble: Check name
            isMatch = selectedNames.has(d.track_name);
        }

        const el = d3.select(this);

        if (isMatch) {
            // --- STATE: HIGHLIGHTED ---
            el.transition().duration(200)
                .style("opacity", 1)           // Fully visible
                .style("stroke", "black")      // Black border
                .style("stroke-width", 3);     // Thick border
        } else {
            // --- STATE: DIMMED (The fix for "Gray Side") ---
            el.transition().duration(200)
                .style("opacity", 0.1)         // Faded
                .style("stroke", "none")       // REMOVE stroke completely
                .style("stroke-width", 0);     // <--- FIX: Ensure width is 0
        }
    });
}