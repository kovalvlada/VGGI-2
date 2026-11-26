'use strict';

let gl;
let surface;
let shProgram;
let spaceball;
let lightAngle = 0;

function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    this.iAttribVertex = -1;
    this.iAttribNormal = -1;
    this.iModelViewMatrix = -1;
    this.iProjectionMatrix = -1;
    this.iNormalMatrix = -1;
    this.iLightPosition = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

function draw() {
    gl.clearColor(0.05, 0.05, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Перспектива
    let projection = m4.perspective(Math.PI / 4, 1, 0.1, 100);

    // ModelView Matrix
    let modelView = spaceball.getViewMatrix();
    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, 0, -10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let modelViewFinal = m4.multiply(translateToPointZero, matAccum0);

    // Normal Matrix (обернена транспонована ModelView 3x3)
    let normalMatrix = m4.identity();
    let invMV = m4.inverse(modelViewFinal);
    let normalMatrix3x3 = [
        invMV[0], invMV[4], invMV[8],
        invMV[1], invMV[5], invMV[9],
        invMV[2], invMV[6], invMV[10]
    ];

    // Обертання точкового джерела світла по колу
    lightAngle += 0.02;
    let radius = 8.0;
    let worldLightPos = [
        radius * Math.cos(lightAngle),
        radius * Math.sin(lightAngle),
        2.0,
        1.0
    ];

    // Множення координат джерела світла на ModelView
    let viewLightPos = m4.transformPoint(modelViewFinal, worldLightPos);

    shProgram.Use();

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelViewFinal);
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, projection);
    gl.uniformMatrix3fv(shProgram.iNormalMatrix, false, normalMatrix3x3);
    gl.uniform3fv(shProgram.iLightPosition, [viewLightPos[0], viewLightPos[1], viewLightPos[2]]);

    surface.Draw(shProgram);

    requestAnimationFrame(draw);
}

function updateSurfaceDetail() {
    const uSteps = parseInt(document.getElementById('uStepsInput').value, 10);
    const vSteps = parseInt(document.getElementById('vStepsInput').value, 10);
    
    document.getElementById('uVal').textContent = uSteps;
    document.getElementById('vVal').textContent = vSteps;

    if (surface) {
        surface.rebuild(uSteps, vSteps);
    }
}

function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    shProgram = new ShaderProgram('GouraudShader', prog);
    shProgram.Use();

    shProgram.iAttribVertex     = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribNormal     = gl.getAttribLocation(prog, "normal");
    shProgram.iModelViewMatrix  = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iProjectionMatrix = gl.getUniformLocation(prog, "ProjectionMatrix");
    shProgram.iNormalMatrix     = gl.getUniformLocation(prog, "NormalMatrix");
    shProgram.iLightPosition    = gl.getUniformLocation(prog, "LightPosition");

    surface = new SurfaceModel(gl, 40, 100);

    gl.enable(gl.DEPTH_TEST);
}

function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in vertex shader: " + gl.getShaderInfoLog(vsh));
    }
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in fragment shader: " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Link error in program: " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if (!gl) {
            throw "Browser does not support WebGL";
        }
    } catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();
    } catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize WebGL: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, null, 0);

    // Слухачі подій для повзунків U та V
    document.getElementById('uStepsInput').addEventListener('input', updateSurfaceDetail);
    document.getElementById('vStepsInput').addEventListener('input', updateSurfaceDetail);

    draw();
}