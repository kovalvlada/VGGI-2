'use strict';

let gl;
let surface;
let shProgram;
let spaceball;
let lightAngle = 0;

let diffuseTexture;
let specularTexture;
let normalTexture;

function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    this.iAttribVertex = -1;
    this.iAttribNormal = -1;
    this.iAttribTangent = -1;
    this.iAttribTexCoord = -1;

    this.iModelViewMatrix = -1;
    this.iProjectionMatrix = -1;
    this.iNormalMatrix = -1;
    this.iLightPosition = -1;

    this.iDiffuseMap = -1;
    this.iSpecularMap = -1;
    this.iNormalMap = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

function isPowerOf2(value) {
    return (value & (value - 1)) === 0;
}

function loadTexture(gl, url, defaultColor) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Тимчасовий 1x1 піксель на час асинхронного завантаження файлу
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                  new Uint8Array(defaultColor));

    const image = new Image();
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        }
    };
    image.src = url;

    return texture;
}

function draw() {
    gl.clearColor(0.05, 0.05, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let projection = m4.perspective(Math.PI / 4, 1, 0.1, 100);

    let modelView = spaceball.getViewMatrix();
    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, 0, -5);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let modelViewFinal = m4.multiply(translateToPointZero, matAccum0);

    let invMV = m4.inverse(modelViewFinal);
    let normalMatrix3x3 = [
        invMV[0], invMV[4], invMV[8],
        invMV[1], invMV[5], invMV[9],
        invMV[2], invMV[6], invMV[10]
    ];

    lightAngle += 0.02;
    let radius = 8.0;
    let worldLightPos = [
        radius * Math.cos(lightAngle),
        radius * Math.sin(lightAngle),
        2.0,
        1.0
    ];

    let viewLightPos = m4.transformPoint(modelViewFinal, worldLightPos);

    shProgram.Use();

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelViewFinal);
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, projection);
    gl.uniformMatrix3fv(shProgram.iNormalMatrix, false, normalMatrix3x3);
    gl.uniform3fv(shProgram.iLightPosition, [viewLightPos[0], viewLightPos[1], viewLightPos[2]]);

    // Прив'язка трьох текстур до відповідних юнітів
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, diffuseTexture);
    gl.uniform1i(shProgram.iDiffuseMap, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, specularTexture);
    gl.uniform1i(shProgram.iSpecularMap, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, normalTexture);
    gl.uniform1i(shProgram.iNormalMap, 2);

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

    shProgram = new ShaderProgram('TextureNormalShader', prog);
    shProgram.Use();

    shProgram.iAttribVertex     = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribNormal     = gl.getAttribLocation(prog, "normal");
    shProgram.iAttribTangent    = gl.getAttribLocation(prog, "tangent");
    shProgram.iAttribTexCoord   = gl.getAttribLocation(prog, "texCoord");

    shProgram.iModelViewMatrix  = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iProjectionMatrix = gl.getUniformLocation(prog, "ProjectionMatrix");
    shProgram.iNormalMatrix     = gl.getUniformLocation(prog, "NormalMatrix");
    shProgram.iLightPosition    = gl.getUniformLocation(prog, "LightPosition");

    shProgram.iDiffuseMap       = gl.getUniformLocation(prog, "uDiffuseMap");
    shProgram.iSpecularMap      = gl.getUniformLocation(prog, "uSpecularMap");
    shProgram.iNormalMap        = gl.getUniformLocation(prog, "uNormalMap");

    // Завантаження текстур із папки textures/
    diffuseTexture  = loadTexture(gl, 'textures/diffuse.jpg',  [200, 200, 200, 255]);
    specularTexture = loadTexture(gl, 'textures/specular.jpg', [255, 255, 255, 255]);
    normalTexture   = loadTexture(gl, 'textures/normal.jpg',   [128, 128, 255, 255]);

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

    document.getElementById('uStepsInput').addEventListener('input', updateSurfaceDetail);
    document.getElementById('vStepsInput').addEventListener('input', updateSurfaceDetail);

    draw();
}