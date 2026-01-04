
const margin = {top: 40, right: 150, bottom: 40, left: 40};
let width, height;
let svg, x, y, color;

// STATE VARIABLES
let rawDataGlobal = [];
let processedData = []; 
let selectedGenres = [];
let currentView = "history"; // 'history', 'range', 'monthly'
let viewStart = 1958;
let viewEnd = 2021;

export function initRankingPlot(containerId, rawData) {
    rawDataGlobal = rawData; 

    // 1. Clear existing
    const container = d3.select(containerId);
    container.selectAll("*").remove();

    // 2. CONTROLS CONTAINER
    const controlsDiv = container.append("div")
        .style("position", "absolute")
        .style("top", "10px")
        .style("left", "50px")
        .style("z-index", "10")
        .style("display", "flex")
        .style("gap", "15px")
        .style("align-items", "center");

    // GENRE SELECTOR
    const dropdown = controlsDiv.append("select")
        .attr("id", "genreSelect")
        .style("font-size", "11px")
        .style("padding", "4px")
        .style("border-radius", "4px")
        .style("border", "1px solid #ccc")
        .style("background", "white");

    // TIME INPUT
    const yearContainer = controlsDiv.append("div")
        .style("display", "flex")
        .style("align-items", "center")
        .style("background", "white")
        .style("padding", "2px 5px")
        .style("border-radius", "4px")
        .style("border", "1px solid #ccc")
        .style("box-shadow", "0 1px 2px rgba(0,0,0,0.05)");

    yearContainer.append("span")
        .text("📅 Time:")
        .style("font-size", "11px")
        .style("font-weight", "bold")
        .style("margin-right", "5px")
        .style("color", "#555");

    const yearInput = yearContainer.append("input")
        .attr("type", "text") 
        .attr("placeholder", "1990 or 1990-2000")
        .style("border", "none")
        .style("outline", "none")
        .style("font-size", "11px")
        .style("width", "110px") 
        .style("color", "#333");

    const goBtn = yearContainer.append("button")
        .text("Go")
        .style("border", "none")
        .style("background", "#4682b4")
        .style("color", "white")
        .style("border-radius", "3px")
        .style("font-size", "10px")
        .style("padding", "3px 8px")
        .style("margin-left", "5px")
        .style("cursor", "pointer")
        .on("click", () => handleInput(yearInput.property("value")));

    const resetBtn = controlsDiv.append("button")
        .text("← Back to History")
        .attr("id", "resetViewBtn")
        .style("display", "none") 
        .style("border", "1px solid #ccc")
        .style("background", "#f8f9fa")
        .style("color", "#333")
        .style("border-radius", "4px")
        .style("font-size", "11px")
        .style("padding", "4px 8px")
        .style("cursor", "pointer")
        .on("click", () => {
            yearInput.property("value", ""); 
            switchToHistoryView();
        });

    // 3. CHART SETUP
    const rect = container.node().getBoundingClientRect();
    width = rect.width - margin.left - margin.right;
    height = rect.height - margin.top - margin.bottom;

    svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${rect.width} ${rect.height}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 4. SCALES
    x = d3.scaleLinear().range([0, width]); 
    y = d3.scaleLinear().domain([1, 100]).range([0, height]);
    color = d3.scaleOrdinal(d3.schemeCategory10);

    // 5. AXES
    // Initialize X Axis Group
    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`);

    // Initialize Y Axis Group
    svg.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(y).tickValues([1, 25, 50, 75, 100]).tickSize(-width))
        .call(g => g.select(".domain").remove()) 
        .call(g => g.selectAll(".tick line").attr("stroke-opacity", 0.1));

    // Labels
    svg.append("text")
        .attr("class", "x-label")
        .attr("x", width)
        .attr("y", height + 30)
        .attr("text-anchor", "end")
        .style("font-size", "10px")
        .style("fill", "#000000ff");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -30)
        .attr("x", 0)
        .attr("text-anchor", "end")
        .text("Avg Rank")
        .style("fill", "#000000ff")
        .style("font-size", "10px");

    // 6. INITIALIZATION
    switchToHistoryView(); 
    initControls(dropdown);

    yearInput.on("keypress", function(event) {
        if (event.key === "Enter") {
            handleInput(this.value);
        }
    });
}

// --- INPUT HANDLING ---

function handleInput(inputVal) {
    const val = inputVal.trim();
    
    if (val.includes("-")) {
        const parts = val.split("-").map(d => parseInt(d.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            const start = Math.min(parts[0], parts[1]);
            const end = Math.max(parts[0], parts[1]);
            if (start < 1958 || end > 2021) {
                alert("Years must be between 1958 and 2021.");
                return;
            }
            switchToRangeView(start, end);
        } else {
            alert("Invalid range format. Use 'YYYY-YYYY'.");
        }
    } else {
        const year = parseInt(val);
        if (!isNaN(year)) {
            if (year < 1958 || year > 2021) {
                alert("Please enter a valid year between 1958 and 2021.");
                return;
            }
            switchToMonthlyView(year);
        } else {
            alert("Invalid input.");
        }
    }
}

// --- VIEW SWITCHING ---

function switchToHistoryView() {
    currentView = "history";
    viewStart = 1958;
    viewEnd = 2021;
    
    d3.select("#resetViewBtn").style("display", "none");
    svg.select(".x-label").text("Year");
    
    selectedGenres = getTopGenres(rawDataGlobal, 5);
    processDataRange(1958, 2021);
    updateChart(); 
}

function switchToRangeView(start, end) {
    currentView = "range";
    viewStart = start;
    viewEnd = end;
    
    d3.select("#resetViewBtn").style("display", "block");
    svg.select(".x-label").text(`Year (${start}-${end})`);

    const rangeData = rawDataGlobal.filter(d => {
        const y = +d.date.split("-")[0];
        return y >= start && y <= end;
    });

    if (rangeData.length === 0) {
        alert("No data found for this range.");
        return;
    }

    selectedGenres = getTopGenres(rangeData, 5);
    processDataRange(start, end);
    updateChart();
}

function switchToMonthlyView(year) {
    currentView = "monthly";
    d3.select("#resetViewBtn").style("display", "block");
    svg.select(".x-label").text(`Month (1-12) of ${year}`);

    const yearData = rawDataGlobal.filter(d => +d.date.split("-")[0] === year);
    if(yearData.length === 0) {
        alert("No data found for this year.");
        return;
    }

    selectedGenres = getTopGenres(yearData, 5);
    processDataMonthly(yearData);
    updateChart();
}

function getTopGenres(data, n) {
    const counts = d3.rollup(data, v => v.length, d => d.track_genre);
    return Array.from(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(d => d[0]);
}

// --- DATA PROCESSING ---

function processDataRange(startYear, endYear) {
    const filtered = rawDataGlobal.filter(d => {
        const y = +d.date.split("-")[0];
        return y >= startYear && y <= endYear;
    });

    const genreGroups = d3.group(filtered, d => d.track_genre, d => +d.date.split("-")[0]);
    
    processedData = [];
    Array.from(genreGroups.keys()).forEach(genre => {
        const yearsMap = genreGroups.get(genre);
        const values = [];
        yearsMap.forEach((rows, year) => {
            const avgRank = d3.mean(rows, r => +r.rank);
            values.push({ x: year, y: avgRank, genre: genre });
        });
        values.sort((a, b) => a.x - b.x);
        processedData.push({ genre: genre, values: values });
    });
}

function processDataMonthly(yearData) {
    const genreGroups = d3.group(yearData, d => d.track_genre, d => +d.date.split("-")[1]);

    processedData = [];
    Array.from(genreGroups.keys()).forEach(genre => {
        const monthMap = genreGroups.get(genre);
        const values = [];
        monthMap.forEach((rows, month) => {
            const avgRank = d3.mean(rows, r => +r.rank);
            values.push({ x: month, y: avgRank, genre: genre });
        });
        values.sort((a, b) => a.x - b.x);
        processedData.push({ genre: genre, values: values });
    });
}

// --- CHART RENDERING ---

function initControls(selectElement) {
    const allGenres = Array.from(new Set(rawDataGlobal.map(d => d.track_genre))).sort();
    selectElement.selectAll("option").remove();
    selectElement.append("option").text("+ Add Genre").attr("disabled", true).attr("selected", true);
    allGenres.forEach(genre => {
        selectElement.append("option").attr("value", genre).text(genre);
    });

    selectElement.on("change", function() {
        const newGenre = this.value;
        if (newGenre && !selectedGenres.includes(newGenre)) {
            selectedGenres.push(newGenre);
            updateChart();
        }
        this.value = "+ Add Genre"; 
    });
}

function updateChart() {
    const activeData = processedData.filter(d => selectedGenres.includes(d.genre));
    const xAxisGroup = svg.select(".x-axis");

    // 1. AXIS LOGIC
    if (currentView === "monthly") {
        x.domain([1, 12]);
        xAxisGroup.transition().duration(750)
            .call(d3.axisBottom(x).ticks(12).tickFormat(d3.format("d"))); 
    } else {
        x.domain([viewStart, viewEnd]);
        
        const rangeSpan = viewEnd - viewStart;
        let tickValues = null;
        if (rangeSpan <= 20) {
            tickValues = d3.range(viewStart, viewEnd + 1);
        }

        const axis = d3.axisBottom(x).tickFormat(d3.format("d"));
        if (tickValues) {
            axis.tickValues(tickValues);
        } else {
            axis.ticks(width > 500 ? 10 : 5);
        }

        xAxisGroup.transition().duration(750).call(axis);
    }

    // 2. DRAW LINES
    const line = d3.line()
        .x(d => x(d.x))
        .y(d => y(d.y))
        .curve(d3.curveMonotoneX);

    const lines = svg.selectAll(".rank-line")
        .data(activeData, d => d.genre);

    lines.exit().transition().duration(500).style("opacity", 0).remove();

    const linesEnter = lines.enter()
        .append("path")
        .attr("class", "rank-line")
        .attr("fill", "none")
        .attr("stroke-width", 2)
        .style("opacity", 0);

    lines.merge(linesEnter)
        .transition().duration(750)
        .style("opacity", 1)
        .attr("d", d => line(d.values))
        .attr("stroke", d => color(d.genre));

    // 3. DRAW DOTS 
    // We create a group for all dots to sit on top of lines
    let dotLayer = svg.select(".dot-layer");
    if (dotLayer.empty()) {
        dotLayer = svg.append("g").attr("class", "dot-layer");
    }

    // Group dots by genre to manage data efficiently
    const genreDotGroups = dotLayer.selectAll(".genre-dot-group")
        .data(activeData, d => d.genre);

    genreDotGroups.exit().remove();

    const genreDotGroupsEnter = genreDotGroups.enter()
        .append("g")
        .attr("class", "genre-dot-group");

    const genreDotGroupsMerged = genreDotGroups.merge(genreDotGroupsEnter);

    // Inside each genre group, draw circles for values
    const circles = genreDotGroupsMerged.selectAll("circle")
        .data(d => d.values.map(v => ({...v, genre: d.genre}))); // Pass genre info down

    circles.exit().transition().duration(500).attr("r", 0).remove();

    circles.enter()
        .append("circle")
        .attr("r", 0)
        .merge(circles)
        .transition().duration(750)
        .attr("cx", d => x(d.x))
        .attr("cy", d => y(d.y))
        .attr("r", 4) // Visible Dot Size
        .attr("fill", d => color(d.genre))
        .attr("stroke", "white")
        .attr("stroke-width", 1.5)
        .style("cursor", "pointer");

    // Tooltip for Dots
    let tooltip = d3.select("body").select(".ranking-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
            .attr("class", "ranking-tooltip")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("background", "rgba(0,0,0,0.8)")
            .style("color", "white")
            .style("padding", "5px 10px")
            .style("border-radius", "4px")
            .style("font-size", "12px")
            .style("pointer-events", "none")
            .style("z-index", "1000");
    }

    genreDotGroupsMerged.selectAll("circle")
        .on("mouseover", function(event, d) {
            d3.select(this).transition().duration(200).attr("r", 7); // Enlarge
            tooltip.transition().duration(200).style("opacity", 0.9);
            
            // Format tooltip text (e.g., "1995: Rank 5")
            const timeLabel = currentView === "monthly" ? `Month: ${d.x}` : `Year: ${d.x}`;
            
            tooltip.html(`
                <strong>${d.genre}</strong><br/>
                ${timeLabel}<br/>
                Rank: ${d.y.toFixed(1)}
            `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).transition().duration(200).attr("r", 4); // Reset size
            tooltip.transition().duration(500).style("opacity", 0);
        });

    updateLegend(activeData);
}

function updateLegend(activeData) {
    const sortedGenres = activeData.sort((a, b) => {
        const lastA = a.values[a.values.length - 1]?.y || 100;
        const lastB = b.values[b.values.length - 1]?.y || 100;
        return lastA - lastB; 
    });

    const legendGroup = svg.selectAll(".legend-group").data([0]).join("g")
        .attr("class", "legend-group")
        .attr("transform", `translate(${width + 10}, 0)`);

    const legendItems = legendGroup.selectAll(".legend-item")
        .data(sortedGenres, d => d.genre);

    legendItems.exit().transition().style("opacity", 0).remove();

    const itemEnter = legendItems.enter().append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * 20})`)
        .style("opacity", 0);

    itemEnter.append("rect")
        .attr("width", 10).attr("height", 10).attr("y", -5).attr("rx", 2)
        .attr("fill", d => color(d.genre));

    itemEnter.append("text")
        .attr("x", 15).attr("y", 4)
        .text(d => d.genre)
        .style("font-size", "11px").style("font-weight", "bold").style("fill", "#333");

    itemEnter.append("text")
        .attr("class", "remove-btn")
        .attr("x", 120).attr("y", 4)
        .text("×")
        .style("font-size", "14px").style("font-weight", "bold").style("fill", "#ccc").style("cursor", "pointer")
        .on("mouseover", function() { d3.select(this).style("fill", "red"); })
        .on("mouseout", function() { d3.select(this).style("fill", "#ccc"); })
        .on("click", (event, d) => {
            selectedGenres = selectedGenres.filter(g => g !== d.genre);
            updateChart();
        });

    legendItems.merge(itemEnter)
        .transition().duration(750)
        .style("opacity", 1)
        .attr("transform", (d, i) => `translate(0, ${i * 20})`);
}