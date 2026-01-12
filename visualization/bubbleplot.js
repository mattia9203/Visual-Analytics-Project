let margin = {}; 
let maxRadius = 0; 
let svg, xScale, yScale, xAxis, yAxis, legendGroup;
let circles;
let totalWidth, totalHeight; 
let onBubbleClickCallback = null; 
let selectedBubbleId = null;

// Tooltip
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", "rgba(255, 255, 255, 0.95)")
    .style("color", "#333")
    .style("border", "1px solid #333")
    .style("padding", "0.5vh") 
    .style("box-shadow", "2px 2px 5px rgba(0,0,0,0.2)")
    .style("border-radius", "0px")
    .style("font-size", "1.2vh") 
    .style("pointer-events", "none")
    .style("opacity", 0);

export function initBubblePlot(containerId, data, onClick) {
    onBubbleClickCallback = onClick;
    d3.select(containerId).selectAll("*").remove();

    const container = d3.select(containerId);
    const rect = container.node().getBoundingClientRect();        //usefull to handle correctly the space     
    
    totalWidth = rect.width;
    totalHeight = rect.height;

    // Dynamic margins
    margin = { 
        top: totalHeight * 0.05,    
        right: totalWidth * 0.05,   
        bottom: totalHeight * 0.15, 
        left: totalWidth * 0.10     
    };

    const drawWidth = totalWidth - margin.left - margin.right;
    const drawHeight = totalHeight - margin.top - margin.bottom;

    svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${totalWidth} ${totalHeight}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales 
    xScale = d3.scaleLinear();
    yScale = d3.scaleLinear();

    xAxis = svg.append("g").attr("class", "x-axis").attr("transform", `translate(0,${drawHeight})`);
    yAxis = svg.append("g").attr("class", "y-axis");

    legendGroup = svg.append("g")
        .attr("class", "legend-group")
        .style("opacity", 0); 

    updateBubblePlot(data, "valence", "energy", "none");
}

//transforms the songs data in 'bubble'
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
            data: values
        };
    });
}

// --- RESPONSIVE LEGEND ---
function drawLegend(rScale, colorScale, plotData, isNumeric, legendW, legendH) {
    legendGroup.selectAll("*").remove();
    
    const titleSize = "1.4vh";
    const labelSize = "1.1vh";
    
    // Positions
    const col1X = legendW * 0.15; 
    const col2X = legendW * 0.55; 

    // --- 1. SIZE LEGEND ---
    const maxCount = rScale.domain()[1];
    const sizeSteps = [0.2, 0.4, 0.6, 0.8, 1.0].map(p => Math.max(1, Math.round(maxCount * p)));
    
    legendGroup.append("text")
        .attr("x", 0)
        .attr("y", 0)
        .text("Songs:") 
        .style("font-size", titleSize)
        .style("font-weight", "bold")
        .style("fill", "#000");

    let currentY = totalHeight * 0.04; 
    
    sizeSteps.forEach((val) => {
        const r = rScale(val);
        legendGroup.append("circle")
            .attr("cx", col1X) 
            .attr("cy", currentY + r)
            .attr("r", r)
            .style("fill", "#dcdcdc") 
            .style("stroke", "none");

        currentY += (r * 2) + (totalHeight * 0.035); 
        
        legendGroup.append("text")
            .attr("x", col1X)
            .attr("y", currentY - (totalHeight * 0.015)) 
            .attr("text-anchor", "middle")
            .text(val)
            .style("font-size", labelSize)
            .style("fill", "#000");
    });

    // --- 2. COLOR LEGEND ---
    legendGroup.append("text")
        .attr("x", col2X)
        .attr("y", 0)
        .text("Range:") 
        .style("font-size", titleSize)
        .style("font-weight", "bold")
        .style("fill", "#000");

    // Increased Box Height for better spacing
    const boxHeight = totalHeight * 0.045; 
    const boxWidth = legendW * 0.15;
    let colY = totalHeight * 0.04;

    if (isNumeric) {
        const domain = colorScale.domain(); 
        const min = domain[1]; 
        const max = domain[0];
        const step = (max - min) / 10;

        for (let i = 0; i < 10; i++) {
            const rangeStart = Math.floor(min + (i * step));
            const rangeEnd = Math.floor(min + ((i + 1) * step));
            const midPoint = (rangeStart + rangeEnd) / 2;
            
            legendGroup.append("rect")
                .attr("x", col2X)
                .attr("y", colY)
                .attr("width", boxWidth)
                .attr("height", boxHeight)
                .style("fill", colorScale(midPoint))
                .style("stroke", "#333")
                .style("stroke-width", "0.5px");

            legendGroup.append("text")
                .attr("x", col2X + boxWidth + (legendW * 0.02))
                .attr("y", colY + (boxHeight / 2) + 1)
                .text(`${rangeStart}-${rangeEnd}`)
                .style("font-size", labelSize)
                .style("alignment-baseline", "middle");

            colY += boxHeight; // Matches increased box height
        }
    } else {
        const categories = colorScale.domain();
        categories.forEach((cat) => {
            legendGroup.append("rect")
                .attr("x", col2X)
                .attr("y", colY)
                .attr("width", boxWidth)
                .attr("height", boxHeight)
                .style("fill", colorScale(cat))
                .style("stroke", "#333")
                .style("stroke-width", "0.5px");

            legendGroup.append("text")
                .attr("x", col2X + boxWidth + (legendW * 0.02))
                .attr("y", colY + (boxHeight / 2) + 1)
                .text(cat)
                .style("font-size", labelSize)
                .style("alignment-baseline", "middle");

            colY += boxHeight;
        });
    }
}

export function updateBubblePlot(data, xAttr, yAttr, groupBy) {
    const t = d3.transition().duration(1000);
    const isGrouped = groupBy !== "none";
    
    // DYNAMIC DIMENSIONS
    const legendSpaceCalc = isGrouped ? (totalWidth * 0.28) : 0;          //check if we need to reserve space for the legend
    const effectiveWidth = totalWidth - margin.left - margin.right - legendSpaceCalc;
    const drawHeight = totalHeight - margin.top - margin.bottom;

    // Max Radius
    maxRadius = totalWidth * 0.035; 

    xScale.range([0, effectiveWidth]);
    yScale.range([drawHeight, 0]);

    selectedBubbleId = null;

    if (isGrouped) {
        legendGroup
            .attr("transform", `translate(${effectiveWidth + (totalWidth * 0.02)}, ${totalHeight * 0.02})`)
            .transition(t).style("opacity", 1);
        d3.select("#song_counter").text(data.length);
    } else {
        legendGroup.transition(t).style("opacity", 0);
        d3.select("#song_counter").text(data.length);
    }

    let plotData = isGrouped ? getAggregatedData(data, groupBy, xAttr, yAttr) : data;        //if group by active then we call getAggregatedData to compress the songs into a bubble objects           

    // Color Scales
    let colorScale;
    let isNumeric = false;

    if (!isGrouped) {
        colorScale = () => "#4682b4"; 
    } else {
        const sampleId = plotData[0].id;
        isNumeric = !isNaN(parseFloat(sampleId));

        if (isNumeric) {
            const domain = d3.extent(plotData, d => +d.id);
            colorScale = d3.scaleLinear()                                       //create a gradient from light blue to dark blue
                .domain(domain)
                .range(["#eff3ff", "#084594"]); 
        } else {
            const categories = plotData.map(d => d.id).sort();
            colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(categories);                    //assing different color for each group
        }
    }

    let xExtent, yExtent;
    // Update Axes
    if (xAttr == "year" || xAttr == "duration_ms" || yAttr == "year" || yAttr == "duration_ms"){
        xExtent = d3.extent(plotData, d => isGrouped  ? d.x : d[xAttr]);
        yExtent = d3.extent(plotData, d => isGrouped ? d.y : d[yAttr]);
    }else{
        xExtent = d3.extent(data, d => +d[xAttr]);
        yExtent = d3.extent(data, d => +d[yAttr]);
    }
    xScale.domain(xExtent[0] === undefined ? [0, 100] : xExtent).nice();
    yScale.domain(yExtent[0] === undefined ? [0, 100] : yExtent).nice();
    yAxis.transition(t).call(d3.axisLeft(yScale));
    xAxis.transition(t).call(d3.axisBottom(xScale));

    // Radius Scale
    const maxCount = d3.max(plotData, d => isGrouped ? d.count : 0);
    const minRadius = totalWidth * 0.005; 

    const rScale = d3.scaleSqrt()
        .domain([0, maxCount])
        .range([minRadius, maxRadius]); 

    if (isGrouped) drawLegend(rScale, colorScale, plotData, isNumeric, legendSpaceCalc, totalHeight);

    // Draw Circles
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

    //allow us to have a smoothly animation when we change x or y
    circles.merge(enter).transition(t)
        .attr("cx", d => xScale(isGrouped ? d.x : d[xAttr]))
        .attr("cy", d => yScale(isGrouped ? d.y : d[yAttr]))
        .attr("r", d => isGrouped ? rScale(d.count) : minRadius * 1.5) 
        .style("fill", d => isGrouped ? (isNumeric ? colorScale(+d.id) : colorScale(d.id)) : "#4682b4")
        .style("opacity", 0.8)
        .style("stroke", "#333");

    //handle the case when we click on a bubble (in group by case)
    circles.merge(enter).on("click", function(event, d) {
        if (!isGrouped) return; 
        const isSelected = (selectedBubbleId === d.id);
        if (isSelected) {
            selectedBubbleId = null;
            d3.selectAll(".bubble").transition().style("opacity", 0.8).style("stroke", "#333");
            if (onBubbleClickCallback) onBubbleClickCallback(null); 
        } else {
            selectedBubbleId = d.id;
            d3.selectAll(".bubble").transition().style("opacity", 0.2);
            d3.select(this).transition().style("opacity", 1).style("stroke", "black").style("stroke-width", 3); 
            if (onBubbleClickCallback) onBubbleClickCallback(d.data);
        }
    });

    circles.exit().transition(t).attr("r", 0).remove();     //remove data that are no longer in the chart
    
    // Handle the mouse over a dot (or bubble) functionality
    circles.merge(enter)
        .on("mouseover", function(event, d) {
            d3.select(this).style("stroke", "#000").style("stroke-width", 2);
            tooltip.transition().duration(100).style("opacity", 1);
            let html = "";
            if (isGrouped) {
                let idDisplay = isNumeric && groupBy === "Real_Year" ? `${d.id}s` : d.id;
                html = `<div style="font-weight:bold; border-bottom:1px solid #ccc; margin-bottom:3px; padding-bottom:2px;">
                            ${idDisplay}
                        </div>
                        <div style="display:flex; justify-content:space-between; min-width:80px;">
                            <span>Songs:</span> <span style="font-weight:bold;">${d.count}</span>
                        </div>
                        <div style="font-size:1.1vh; color:#555; margin-top:3px;">
                            X: ${d.x.toFixed(2)} | Y: ${d.y.toFixed(2)}
                        </div>`;
            } else {
                html = `<div style="font-weight:bold;">${d.track_name}</div>
                        <div style="font-size:1.1vh; color:#555;">${d.artists}</div>`;
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

//Handle the interaction with other charts
export function highlightBubblePlot(subsetData) {
    const circles = d3.selectAll(".bubble");
    circles.interrupt();

    //Restore the original chart if no subset data selected
    if (!subsetData || subsetData.length === 0) {       
        circles.transition().duration(200)
            .style("opacity", 0.8).style("stroke", "#333").style("stroke-width", 1);
        return;
    }

    const selectedNames = new Set(subsetData.map(d => d.track_id));           //transform the list of filtered songs into a set (computational time decreased)

    //Check which bubbles are related to a song selected (also in the group by case)
    circles.each(function(d) {
        let isMatch = false;
        if (d.data) {
            isMatch = d.data.some(song => selectedNames.has(song.track_id));          //in the group by case, we need to check if a bubble contains SOME song matched
        } else {
            isMatch = selectedNames.has(d.track_id);
        }

        //Allow us to see the differences between selected and not selected dots (or bubbles) 
        const el = d3.select(this);
        if (isMatch) {
            el.transition().duration(200).style("opacity", 1).style("stroke", "black").style("stroke-width", 3);
        } else {
            el.transition().duration(200).style("opacity", 0.1).style("stroke", "none").style("stroke-width", 0);
        }
    });
}