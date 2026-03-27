class GridGame {
    constructor(size = 18) {
        this.size = size;
        this.grid = [];
        this.players = ['A', 'B'];
        this.maxStartsPerPlayer = 5;
        this.playerPositions = { A: [], B: [] };
        this.playerColors = { A: [], B: [] };
        this.playerPaths = { A: [], B: [] };
        this.scores = { A: 0, B: 0 };
        this.currentPlayer = 'A';
        this.maxPathLength = 0;
        this.stepCount = 0;
        this.selectingStart = false;
        this.selectingPlayer = null;
        this.selectionPhase = 'idle';
        this.turnTimeLimit = 20;
        this.timerEnabled = true;
        this.timeLeft = this.turnTimeLimit;
        this.timerInterval = null;

        // 历史记录用于撤销/重做
        this.history = [];
        this.historyIndex = -1;

        this.init();
    }

    init() {
        this.generateGrid();
        this.renderGrid();
        this.bindEvents();
        this.renderAxes();
        this.updateStats();
        this.updatePathDisplay();
        this.updateStartPointsList();
    }

    renderAxes() {
        const axisTop = document.getElementById('axisTop');
        const axisBottom = document.getElementById('axisBottom');
        const axisLeft = document.getElementById('axisLeft');
        const axisRight = document.getElementById('axisRight');

        if (!axisTop || !axisBottom || !axisLeft || !axisRight) {
            return;
        }

        const labels = Array.from({ length: this.size }, (_, i) => i + 1);

        const createRow = () => labels.map(value =>
            `<div class="axis-label">${value}</div>`
        ).join('');

        const createCol = () => labels.map(value =>
            `<div class="axis-label">${value}</div>`
        ).join('');

        axisTop.innerHTML = createRow();
        axisBottom.innerHTML = createRow();
        axisLeft.innerHTML = createCol();
        axisRight.innerHTML = createCol();
    }

    generateGrid() {
        this.grid = [];
        for (let i = 0; i < this.size; i++) {
            const row = [];
            for (let j = 0; j < this.size; j++) {
                const num = Math.floor(Math.random() * 10);
                const letter = ['A', 'B', 'C', 'D', 'E'][Math.floor(Math.random() * 5)];
                row.push(`${letter}${num}`);
            }
            this.grid.push(row);
        }
    }

    generateStartColor(player, index) {
        const palettes = {
            A: [
                '#48bb78', // 绿色
                '#38a169',
                '#68d391',
                '#2f855a',
                '#9ae6b4'
            ],
            B: [
                '#4299e1', // 蓝色
                '#3182ce',
                '#63b3ed',
                '#2b6cb0',
                '#90cdf4'
            ]
        };
        const palette = palettes[player] || palettes.A;
        return palette[index % palette.length];
    }

    getOtherPlayer(player) {
        return player === 'A' ? 'B' : 'A';
    }

    setCurrentPlayer(nextPlayer) {
        const previousPlayer = this.currentPlayer;
        this.currentPlayer = nextPlayer;

        // 一个完整回合定义为 A 和 B 都行动一次：仅在 B -> A 时 +1
        if (previousPlayer === 'B' && nextPlayer === 'A') {
            this.stepCount += 1;
        }
    }

    isPositionOccupiedBy(row, col, player) {
        return this.playerPositions[player].some(pos => pos[0] === row && pos[1] === col);
    }

    isPositionOccupied(row, col) {
        return this.players.some(player => this.isPositionOccupiedBy(row, col, player));
    }

    renderGrid() {
        const board = document.getElementById('gameBoard');
        board.innerHTML = '';

        const positionMap = new Map();
        this.players.forEach(player => {
            this.playerPositions[player].forEach((pos, index) => {
                positionMap.set(`${pos[0]},${pos[1]}`, {
                    player,
                    color: this.playerColors[player][index]
                });
            });
        });

        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                const cellContent = this.grid[i][j];
                cell.textContent = cellContent || '·';
                cell.dataset.row = i;
                cell.dataset.col = j;

                // 空格子样式
                if (!cellContent) {
                    cell.classList.add('empty');
                }
                // 检查是否是任一玩家的起点
                else {
                    const posKey = `${i},${j}`;
                    const occupied = positionMap.get(posKey);
                    if (occupied) {
                        cell.classList.add('current');
                        cell.classList.add(occupied.player === 'A' ? 'player-a' : 'player-b');
                        cell.style.backgroundColor = occupied.color;
                        cell.style.borderColor = occupied.color;
                    }
                    // 高亮可选择的起点
                    else if (this.selectingStart && this.selectingPlayer) {
                        const opponent = this.getOtherPlayer(this.selectingPlayer);
                        const isOpponentOccupied = this.isPositionOccupiedBy(i, j, opponent);
                        if (!isOpponentOccupied) {
                            cell.classList.add('selectable');
                        }
                    }
                }

                cell.addEventListener('click', () => this.handleCellClick(i, j));
                board.appendChild(cell);
            }
        }

        this.updateAvailableMoves();
    }

    isInPath(row, col) {
        const path = this.playerPaths[this.currentPlayer] || [];
        return path.some(entry => {
            if (Array.isArray(entry[0])) {
                return entry.some(pos => pos[0] === row && pos[1] === col);
            }
            return entry[0] === row && entry[1] === col;
        });
    }

    handleCellClick(row, col) {
        if (this.selectingStart && this.selectingPlayer) {
            // 只能选择非空格子作为起点
            if (this.grid[row][col]) {
                const opponent = this.getOtherPlayer(this.selectingPlayer);
                if (this.isPositionOccupiedBy(row, col, opponent)) {
                    alert('该位置已被对方占用，请选择其他位置！');
                    return;
                }

                const currentPositions = this.playerPositions[this.selectingPlayer];
                const currentColors = this.playerColors[this.selectingPlayer];
                // 检查是否已经选择了这个位置
                const existingIndex = currentPositions.findIndex(
                    pos => pos[0] === row && pos[1] === col
                );

                if (existingIndex !== -1) {
                    // 如果已选择，则取消选择
                    currentPositions.splice(existingIndex, 1);
                    currentColors.splice(existingIndex, 1);
                } else {
                    if (currentPositions.length >= this.maxStartsPerPlayer) {
                        alert(`每位玩家最多选择 ${this.maxStartsPerPlayer} 个起点！`);
                        return;
                    }
                    // 添加新起点
                    currentPositions.push([row, col]);
                    currentColors.push(this.generateStartColor(this.selectingPlayer, currentPositions.length - 1));
                }

                this.renderGrid();
                this.updateStartPointsList();
            } else {
                alert('请选择一个非空格子作为起点！');
            }
        }
    }

    finishSelectingStarts() {
        if (!this.selectingPlayer) {
            return;
        }

        const player = this.selectingPlayer;
        const positions = this.playerPositions[player];

        if (positions.length === 0) {
            alert('请至少选择一个起点！');
            return;
        }

        this.playerPaths[player] = positions.map(pos => [...pos]);

        if (this.playerPaths[player].length > this.maxPathLength) {
            this.maxPathLength = this.playerPaths[player].length;
        }

        if (player === 'A') {
            this.selectingPlayer = 'B';
            this.selectionPhase = 'B';
            this.selectingStart = true;
        } else {
            this.selectingStart = false;
            this.selectionPhase = 'done';
            this.currentPlayer = 'A';

            // 保存初始状态
            this.saveState();
            this.startTurnTimer();
        }

        this.updateStats();
        this.updatePathDisplay();
        this.updateStartPointsList();
        this.renderGrid();
    }

    updateStartPointsList() {
        const listA = document.getElementById('startPointsListA');
        const listB = document.getElementById('startPointsListB');
        if (!listA || !listB) return;

        const renderList = (player, listEl) => {
            const positions = this.playerPositions[player];
            const colors = this.playerColors[player];

            if (positions.length === 0) {
                const message = this.selectionPhase === 'idle'
                    ? '点击"开始游戏"开始'
                    : player === 'A'
                        ? '点击棋盘选择起点'
                        : this.selectionPhase === 'A'
                            ? '等待玩家 A 完成'
                            : '点击棋盘选择起点';
                listEl.innerHTML = `<p class="empty-message">${message}</p>`;
                return;
            }

            listEl.innerHTML = positions.map((pos, index) => {
                const cell = this.grid[pos[0]][pos[1]];
                const playerClass = player === 'A' ? 'player-a' : 'player-b';
                const displayRow = pos[0] + 1;
                const displayCol = pos[1] + 1;
                return `<div class="start-point-item ${playerClass}" style="border-left-color: ${colors[index]}">
                    <span>起点${index + 1}: (${displayRow}, ${displayCol}) [${cell}]</span>
                </div>`;
            }).join('');
        };

        renderList('A', listA);
        renderList('B', listB);
    }

    getNeighbors(pos) {
        const [row, col] = pos;
        const neighbors = [];
        const directions = [
            [-1, 0, '↑'],  // 上
            [1, 0, '↓'],   // 下
            [0, -1, '←'],  // 左
            [0, 1, '→']    // 右
        ];

        for (const [dr, dc, symbol] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow < this.size && newCol >= 0 && newCol < this.size) {
                neighbors.push([[newRow, newCol], symbol]);
            }
        }

        return neighbors;
    }

    canMove(fromPos, toPos) {
        const fromCell = this.grid[fromPos[0]][fromPos[1]];
        const toCell = this.grid[toPos[0]][toPos[1]];

        // 允许移动到空格子
        if (!toCell) {
            return true;
        }

        const fromLetter = fromCell[0];
        const fromNum = fromCell[1];
        const toLetter = toCell[0];
        const toNum = toCell[1];

        return fromNum === toNum || fromLetter === toLetter;
    }

    mergeCells(fromPos, toPos) {
        const fromCell = this.grid[fromPos[0]][fromPos[1]];
        const toCell = this.grid[toPos[0]][toPos[1]];

        // 如果目标格子是空的，把原格子的内容移动过去
        if (!toCell) {
            this.grid[toPos[0]][toPos[1]] = fromCell;  // 目标位置设为原内容
            this.grid[fromPos[0]][fromPos[1]] = '';    // 清空原位置
            return toPos;
        }

        const fromLetter = fromCell[0];
        const fromNum = parseInt(fromCell[1]);
        const toLetter = toCell[0];
        const toNum = parseInt(toCell[1]);

        let newNum, newLetter;

        // 数字和字母都相同
        if (fromNum === toNum && fromLetter === toLetter) {
            newNum = toNum;
            newLetter = toLetter;
        }
        // 只有字母相同
        else if (fromLetter === toLetter) {
            newNum = (fromNum + toNum) % 10;
            newLetter = toLetter;
        }
        // 只有数字相同
        else {
            const letterMap = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 0 };
            const reverseMap = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 0: 'E' };
            const newLetterVal = (letterMap[fromLetter] + letterMap[toLetter]) % 5;
            newLetter = reverseMap[newLetterVal];
            newNum = toNum;
        }

        // 清空原来的格子
        this.grid[fromPos[0]][fromPos[1]] = '';
        // 更新目标格子
        this.grid[toPos[0]][toPos[1]] = `${newLetter}${newNum}`;
        return toPos;
    }

    move(direction) {
        if (this.selectionPhase !== 'done') {
            alert('请先完成起点选择！');
            return;
        }

        const activePlayer = this.currentPlayer;
        const opponent = this.getOtherPlayer(activePlayer);
        const activePositions = this.playerPositions[activePlayer];

        if (activePositions.length === 0) {
            alert('当前玩家没有可移动的棋子！');
            return;
        }

        const directionMap = {
            'up': [-1, 0],
            'down': [1, 0],
            'left': [0, -1],
            'right': [0, 1]
        };

        const [dr, dc] = directionMap[direction];
        const pathIncremented = [];
        let captures = 0;

        const activePieces = activePositions.map((pos, index) => ({
            pos: [...pos],
            color: this.playerColors[activePlayer][index]
        }));

        const ordering = (a, b) => {
            const [ar, ac] = a.pos;
            const [br, bc] = b.pos;
            if (direction === 'left') {
                return ac - bc || ar - br;
            }
            if (direction === 'right') {
                return bc - ac || ar - br;
            }
            if (direction === 'up') {
                return ar - br || ac - bc;
            }
            return br - ar || ac - bc;
        };

        activePieces.sort(ordering);

        const activePositionsSnapshot = activePieces.map(piece => piece.pos);
        const activeColorsSnapshot = activePieces.map(piece => piece.color);
        const opponentPositionsSnapshot = this.playerPositions[opponent].map(pos => [...pos]);
        const opponentColorsSnapshot = [...this.playerColors[opponent]];

        const keyOf = (row, col) => `${row},${col}`;
        const activeAlive = new Set(activePositionsSnapshot.map(pos => keyOf(pos[0], pos[1])));
        const opponentAlive = new Set(opponentPositionsSnapshot.map(pos => keyOf(pos[0], pos[1])));

        const newPieces = [];
        const keyToIndex = new Map();

        const removePlacedPieceAtKey = (key) => {
            const index = keyToIndex.get(key);
            if (index === undefined) return;
            const lastIndex = newPieces.length - 1;
            if (index !== lastIndex) {
                const lastPiece = newPieces[lastIndex];
                newPieces[index] = lastPiece;
                keyToIndex.set(lastPiece.key, index);
            }
            newPieces.pop();
            keyToIndex.delete(key);
        };

        // 检查所有起点的移动
        for (let i = 0; i < activePositionsSnapshot.length; i++) {
            const [currentRow, currentCol] = activePositionsSnapshot[i];
            const currentKey = keyOf(currentRow, currentCol);

            if (!activeAlive.has(currentKey)) {
                continue; // 已被消除
            }

            const newRow = currentRow + dr;
            const newCol = currentCol + dc;

            // 检查边界
            if (newRow < 0 || newRow >= this.size || newCol < 0 || newCol >= this.size) {
                newPieces.push({ pos: [currentRow, currentCol], color: activeColorsSnapshot[i], key: currentKey });
                keyToIndex.set(currentKey, newPieces.length - 1);
                pathIncremented.push(false);
                continue;
            }

            const newPos = [newRow, newCol];
            const newKey = keyOf(newRow, newCol);
            const targetCell = this.grid[newRow][newCol];

            // 检查是否可以移动
            if (!this.canMove([currentRow, currentCol], newPos)) {
                newPieces.push({ pos: [currentRow, currentCol], color: activeColorsSnapshot[i], key: currentKey });
                keyToIndex.set(currentKey, newPieces.length - 1);
                pathIncremented.push(false);
                continue;
            }

            if (activeAlive.has(newKey)) {
                activeAlive.delete(newKey);
                removePlacedPieceAtKey(newKey);
            }

            if (opponentAlive.has(newKey)) {
                opponentAlive.delete(newKey);
            }

            if (targetCell) {
                captures += 1;
            }

            // 执行移动
            const resultPos = this.mergeCells([currentRow, currentCol], newPos);

            // 更新存活集合
            activeAlive.delete(currentKey);
            activeAlive.add(newKey);

            newPieces.push({ pos: resultPos, color: activeColorsSnapshot[i], key: newKey });
            keyToIndex.set(newKey, newPieces.length - 1);

            // 判断是否计入路径
            if (targetCell) {
                pathIncremented.push(true);
            } else {
                pathIncremented.push(false);
            }
        }

        // 更新当前玩家位置
        this.playerPositions[activePlayer] = newPieces.map(piece => piece.pos);
        this.playerColors[activePlayer] = newPieces.map(piece => piece.color);

        // 移除被消除的对手棋子
        const newOpponentPositions = [];
        const newOpponentColors = [];
        for (let i = 0; i < opponentPositionsSnapshot.length; i++) {
            const [row, col] = opponentPositionsSnapshot[i];
            const key = keyOf(row, col);
            if (opponentAlive.has(key)) {
                newOpponentPositions.push([row, col]);
                newOpponentColors.push(opponentColorsSnapshot[i]);
            }
        }
        this.playerPositions[opponent] = newOpponentPositions;
        this.playerColors[opponent] = newOpponentColors;

        // 如果有任何起点计入了路径，记录路径
        if (pathIncremented.some(v => v)) {
            this.playerPaths[activePlayer].push(
                this.playerPositions[activePlayer].map(pos => [...pos])
            );

            // 更新最长路径
            if (this.playerPaths[activePlayer].length > this.maxPathLength) {
                this.maxPathLength = this.playerPaths[activePlayer].length;
            }
        }

        // 如果所有起点都被消除了
        if (this.playerPositions[activePlayer].length === 0) {
            alert('所有起点都已消除！请选择新的起点。');
        }

        if (captures > 0) {
            this.scores[activePlayer] += captures;
            this.setCurrentPlayer(opponent);
            this.startTurnTimer();
        }

        // 保存状态到历史记录
        this.saveState();

        this.updateStats();
        this.updatePathDisplay();
        this.updateStartPointsList();
        this.renderGrid();
    }

    updateStats() {
        const stepCountEl = document.getElementById('stepCount');
        if (stepCountEl) stepCountEl.textContent = this.stepCount;

        const activePlayer = this.currentPlayer;

        const currentPlayerLabel = this.selectionPhase === 'A'
            ? '玩家 A 选起点中'
            : this.selectionPhase === 'B'
                ? '玩家 B 选起点中'
                : `玩家 ${this.currentPlayer}`;

        const currentPlayerEl = document.getElementById('currentPlayer');
        if (currentPlayerEl) {
            currentPlayerEl.textContent = currentPlayerLabel;
        }

        const scoreA = document.getElementById('scoreA');
        const scoreB = document.getElementById('scoreB');
        if (scoreA) scoreA.textContent = this.scores.A;
        if (scoreB) scoreB.textContent = this.scores.B;

        const timerEl = document.getElementById('turnTimer');
        if (timerEl) {
            timerEl.textContent = `${this.timeLeft}s`;
        }

        const boardWrapper = document.querySelector('.game-board-wrapper');
        if (boardWrapper) {
            boardWrapper.classList.remove('turn-a', 'turn-b');
            if (this.selectionPhase === 'A' || this.selectionPhase === 'B') {
                boardWrapper.classList.add(this.selectionPhase === 'A' ? 'turn-a' : 'turn-b');
            } else if (this.selectionPhase === 'done') {
                boardWrapper.classList.add(this.currentPlayer === 'A' ? 'turn-a' : 'turn-b');
            }
        }

        // 更新撤销/重做按钮状态
        this.updateUndoRedoButtons();
        this.updateControlStates();
    }

    saveState() {
        const clonePath = (path) => path.map(entry =>
            Array.isArray(entry[0]) ? entry.map(pos => [...pos]) : [...entry]
        );

        // 深拷贝当前状态
        const state = {
            grid: this.grid.map(row => [...row]),
            playerPositions: {
                A: this.playerPositions.A.map(pos => [...pos]),
                B: this.playerPositions.B.map(pos => [...pos])
            },
            playerColors: {
                A: [...this.playerColors.A],
                B: [...this.playerColors.B]
            },
            playerPaths: {
                A: clonePath(this.playerPaths.A),
                B: clonePath(this.playerPaths.B)
            },
            scores: { ...this.scores },
            currentPlayer: this.currentPlayer,
            selectingStart: this.selectingStart,
            selectingPlayer: this.selectingPlayer,
            selectionPhase: this.selectionPhase,
            stepCount: this.stepCount,
            maxPathLength: this.maxPathLength
        };

        // 删除当前索引之后的所有历史记录
        this.history = this.history.slice(0, this.historyIndex + 1);

        // 添加新状态
        this.history.push(state);
        this.historyIndex++;

        // 限制历史记录数量（最多保存50步）
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }

        this.updateUndoRedoButtons();
    }

    undo() {
        if (this.historyIndex <= 0) {
            return; // 没有可撤销的操作
        }

        this.historyIndex--;
        this.restoreState(this.history[this.historyIndex]);
    }

    redo() {
        if (this.historyIndex >= this.history.length - 1) {
            return; // 没有可重做的操作
        }

        this.historyIndex++;
        this.restoreState(this.history[this.historyIndex]);
    }

    restoreState(state) {
        this.grid = state.grid.map(row => [...row]);
        this.playerPositions = {
            A: state.playerPositions.A.map(pos => [...pos]),
            B: state.playerPositions.B.map(pos => [...pos])
        };
        this.playerColors = {
            A: [...state.playerColors.A],
            B: [...state.playerColors.B]
        };
        this.playerPaths = {
            A: state.playerPaths.A.map(entry =>
                Array.isArray(entry[0]) ? entry.map(pos => [...pos]) : [...entry]
            ),
            B: state.playerPaths.B.map(entry =>
                Array.isArray(entry[0]) ? entry.map(pos => [...pos]) : [...entry]
            )
        };
        this.scores = { ...state.scores };
        this.currentPlayer = state.currentPlayer;
        this.selectingStart = state.selectingStart;
        this.selectingPlayer = state.selectingPlayer;
        this.selectionPhase = state.selectionPhase;
        this.stepCount = state.stepCount;
        this.maxPathLength = state.maxPathLength;

        this.updateStats();
        this.updatePathDisplay();
        this.updateStartPointsList();
        this.renderGrid();
    }

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        const canUndoRedo = this.selectionPhase === 'done';

        if (undoBtn) {
            undoBtn.disabled = !canUndoRedo || this.historyIndex <= 0;
        }
        if (redoBtn) {
            redoBtn.disabled = !canUndoRedo || this.historyIndex >= this.history.length - 1;
        }
    }

    updateControlStates() {
        const mainBtn = document.getElementById('newStartBtn');
        if (mainBtn) {
            if (this.selectionPhase === 'idle') {
                mainBtn.textContent = '开始游戏';
                mainBtn.disabled = false;
            } else if (this.selectingStart && this.selectingPlayer) {
                const playerLabel = this.selectingPlayer === 'A' ? 'A' : 'B';
                mainBtn.textContent = `完成玩家 ${playerLabel} 选点`;
                mainBtn.disabled = false;
            } else {
                mainBtn.textContent = '游戏进行中';
                mainBtn.disabled = true;
            }
        }

        const skipTurnBtn = document.getElementById('skipTurnBtn');
        if (skipTurnBtn) {
            skipTurnBtn.disabled = this.selectionPhase !== 'done';
        }

        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.disabled = this.selectionPhase === 'idle';
        }

        const arrowBtnIds = ['upBtn', 'downBtn', 'leftBtn', 'rightBtn'];
        arrowBtnIds.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = this.selectionPhase !== 'done';
            }
        });

        const timerToggle = document.getElementById('timerToggle');
        if (timerToggle) {
            timerToggle.disabled = this.selectionPhase !== 'done';
        }
    }

    updatePathDisplay() {
        const pathList = document.getElementById('pathList');

        if (this.selectionPhase !== 'done') {
            pathList.innerHTML = '<p class="empty-message">请完成起点选择</p>';
            return;
        }

        const currentPath = this.playerPaths[this.currentPlayer] || [];

        if (currentPath.length === 0) {
            pathList.innerHTML = '<p class="empty-message">当前玩家暂无路径</p>';
            return;
        }

        pathList.innerHTML = currentPath.map((entry, index) => {
            if (Array.isArray(entry[0])) {
                // 多个起点的情况
                const positionsStr = entry.map(pos => {
                    const cell = this.grid[pos[0]][pos[1]] || '空';
                    const displayRow = pos[0] + 1;
                    const displayCol = pos[1] + 1;
                    return `(${displayRow},${displayCol})[${cell}]`;
                }).join(', ');
                return `<div class="path-item">${index + 1}. ${positionsStr}</div>`;
            } else {
                // 单个起点的情况
                const cell = this.grid[entry[0]][entry[1]] || '空';
                const displayRow = entry[0] + 1;
                const displayCol = entry[1] + 1;
                return `<div class="path-item">${index + 1}. (${displayRow}, ${displayCol}) [${cell}]</div>`;
            }
        }).join('');

        // 自动滚动到底部
        pathList.scrollTop = pathList.scrollHeight;
    }

    updateAvailableMoves() {
        const movesList = document.getElementById('movesList');
        if (!movesList) {
            return;
        }

        if (this.selectionPhase !== 'done') {
            movesList.innerHTML = '<p class="empty-message">请完成起点选择</p>';
            return;
        }

        const activePositions = this.playerPositions[this.currentPlayer];

        if (activePositions.length === 0) {
            movesList.innerHTML = '<p class="empty-message">暂无可用移动</p>';
            return;
        }

        // 检查所有方向
        const directions = [
            [[-1, 0], '↑ 上'],
            [[1, 0], '↓ 下'],
            [[0, -1], '← 左'],
            [[0, 1], '→ 右']
        ];

        const availableMoves = [];

        for (const [[dr, dc], name] of directions) {
            let canAnyMove = false;

            for (const [row, col] of activePositions) {
                const newRow = row + dr;
                const newCol = col + dc;

                // 检查边界
                if (newRow >= 0 && newRow < this.size && newCol >= 0 && newCol < this.size) {
                    const newPos = [newRow, newCol];
                    if (this.canMove([row, col], newPos)) {
                        canAnyMove = true;
                        break;
                    }
                }
            }

            if (canAnyMove) {
                availableMoves.push(name);
            }
        }

        if (availableMoves.length === 0) {
            movesList.innerHTML = '<p class="empty-message">没有可用移动！</p>';
            return;
        }

        movesList.innerHTML = availableMoves.map(move => {
            return `<div class="move-item">
                <span>${move}</span>
            </div>`;
        }).join('');
    }

    skipTurn() {
        if (this.selectionPhase !== 'done') {
            alert('请先完成起点选择！');
            return;
        }

        this.setCurrentPlayer(this.getOtherPlayer(this.currentPlayer));
        this.saveState();
        this.startTurnTimer();
        this.updateStats();
        this.updatePathDisplay();
        this.updateStartPointsList();
        this.renderGrid();
    }

    startSelection() {
        this.playerPositions = { A: [], B: [] };
        this.playerColors = { A: [], B: [] };
        this.playerPaths = { A: [], B: [] };
        this.scores = { A: 0, B: 0 };
        this.stepCount = 0;
        this.maxPathLength = 0;
        this.currentPlayer = 'A';
        this.selectingStart = true;
        this.selectingPlayer = 'A';
        this.selectionPhase = 'A';
        this.history = [];
        this.historyIndex = -1;
        this.stopTimer();
        this.timeLeft = this.turnTimeLimit;
        this.updateStats();
        this.updatePathDisplay();
        this.updateStartPointsList();
        this.renderGrid();
    }

    startTurnTimer() {
        this.stopTimer();

        if (!this.timerEnabled || this.selectionPhase !== 'done') {
            this.timeLeft = this.turnTimeLimit;
            this.updateStats();
            return;
        }

        this.timeLeft = this.turnTimeLimit;
        this.updateStats();

        this.timerInterval = setInterval(() => {
            this.timeLeft -= 1;
            if (this.timeLeft <= 0) {
                this.timeLeft = 0;
                this.updateStats();
                this.skipTurn();
                return;
            }
            this.updateStats();
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    bindEvents() {
        // 主按钮：未开始时开始游戏；选点阶段完成当前玩家选点
        document.getElementById('newStartBtn').addEventListener('click', () => {
            if (this.selectionPhase === 'idle') {
                this.startSelection();
                return;
            }

            if (this.selectingStart && this.selectingPlayer) {
                this.finishSelectingStarts();
            }
        });

        // 重置按钮
        document.getElementById('resetBtn').addEventListener('click', () => {
            if (confirm('确定要重置游戏吗？这将清除所有进度。')) {
                this.reset();
            }
        });

        // 跳过回合按钮
        document.getElementById('skipTurnBtn').addEventListener('click', () => {
            this.skipTurn();
        });

        // 回合计时开关
        const timerToggle = document.getElementById('timerToggle');
        if (timerToggle) {
            timerToggle.addEventListener('change', (e) => {
                this.timerEnabled = e.target.checked;
                if (this.timerEnabled) {
                    this.startTurnTimer();
                } else {
                    this.stopTimer();
                    this.timeLeft = this.turnTimeLimit;
                    this.updateStats();
                }
            });
        }

        // 撤销按钮
        document.getElementById('undoBtn').addEventListener('click', () => {
            this.undo();
        });

        // 重做按钮
        document.getElementById('redoBtn').addEventListener('click', () => {
            this.redo();
        });

        // 方向按钮
        document.getElementById('upBtn').addEventListener('click', () => this.move('up'));
        document.getElementById('downBtn').addEventListener('click', () => this.move('down'));
        document.getElementById('leftBtn').addEventListener('click', () => this.move('left'));
        document.getElementById('rightBtn').addEventListener('click', () => this.move('right'));

        // 键盘控制
        document.addEventListener('keydown', (e) => {
            if (this.selectingStart) return;

            // Ctrl+Z 撤销
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                this.undo();
                return;
            }

            // Ctrl+Y 或 Ctrl+Shift+Z 重做
            if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
                e.preventDefault();
                this.redo();
                return;
            }

            const key = e.key.toLowerCase();
            const isPlayerA = this.currentPlayer === 'A';

            if (isPlayerA) {
                switch (key) {
                    case 'arrowup':
                        e.preventDefault();
                        this.move('up');
                        return;
                    case 'arrowdown':
                        e.preventDefault();
                        this.move('down');
                        return;
                    case 'arrowleft':
                        e.preventDefault();
                        this.move('left');
                        return;
                    case 'arrowright':
                        e.preventDefault();
                        this.move('right');
                        return;
                }
            } else {
                switch (key) {
                    case 'w':
                        e.preventDefault();
                        this.move('up');
                        return;
                    case 's':
                        e.preventDefault();
                        this.move('down');
                        return;
                    case 'a':
                        e.preventDefault();
                        this.move('left');
                        return;
                    case 'd':
                        e.preventDefault();
                        this.move('right');
                        return;
                }
            }

            switch (key) {
                case 'n':
                    e.preventDefault();
                    this.startSelection();
                    break;
                case 'r':
                    e.preventDefault();
                    if (confirm('确定要重置游戏吗？')) {
                        this.reset();
                    }
                    break;
            }
        });
    }

    reset() {
        this.playerPositions = { A: [], B: [] };
        this.playerColors = { A: [], B: [] };
        this.playerPaths = { A: [], B: [] };
        this.scores = { A: 0, B: 0 };
        this.maxPathLength = 0;
        this.stepCount = 0;
        this.currentPlayer = 'A';
        this.selectingStart = false;
        this.selectingPlayer = null;
        this.selectionPhase = 'idle';
        this.history = [];
        this.historyIndex = -1;
        this.stopTimer();
        this.timeLeft = this.turnTimeLimit;
        this.generateGrid();
        this.renderGrid();
        this.updateStats();
        this.updatePathDisplay();
        this.updateStartPointsList();
    }
}

// 初始化游戏
let game;
window.addEventListener('DOMContentLoaded', () => {
    game = new GridGame(18);
});
