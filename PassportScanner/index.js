let router = null;
let view;
let cameraEnhancer = null;
let promiseCVRReady = null;
let recognizedText;

const startScaningBtn = document.querySelector(".btn-open-recognize");
const restartVideoBtn = document.querySelector(".btn-restart-video");
const cameraViewContainer = document.querySelector(".div-ui-container");
const textLoading = document.querySelector(".text-loading");
const resultContainer = document.querySelector(".result-container");
const normalizedImageArea = document.querySelector(".normalized-image-area");
const parsedResultArea = document.querySelector(".parsed-result-area");

/** LICENSE ALERT - README
 * To use the library, you need to first specify a license key using the API "license" as shown below.
 */
Dynamsoft.License.LicenseManager.initLicense("DLS2eyJvcmdhbml6YXRpb25JRCI6IjIwMDAwMSJ9");
//Dynamsoft.License.LicenseManager.initLicense("DLS2eyJoYW5kc2hha2VDb2RlIjoiODAwMC04MDAwIiwibWFpblNlcnZlclVSTCI6Imh0dHBzOi8vMTkyLjE2OC44LjEyMi9kbHMvIiwib3JnYW5pemF0aW9uSUQiOiI4MDAwIiwiY2hlY2tDb2RlIjotMTA1NjUzOTM3M30=", true);
/** 
 * You can visit https://www.dynamsoft.com/customer/license/trialLicense?utm_source=github&product=dlr&package=js to get your own trial license good for 30 days. 
 * Note that if you downloaded this sample from Dynamsoft while logged in, the above license key may already be your own 30-day trial license.
 * For more information, see https://www.dynamsoft.com/label-recognition/programming/javascript/user-guide.html?ver=latest#specify-the-license or contact support@dynamsoft.com.
 * LICENSE ALERT - THE END 
 */

Dynamsoft.DLR.LabelRecognizerModule.onDataLoadProgressChanged = (modelPath, tag, progress) => {
    if (tag === "starting") {
        textLoading.style.display = "inline";
    } else if (tag === "completed") {
        textLoading.style.display = "none";
    };
}


/**
 * Preloads the `LabelRecognizer` module
 */
Dynamsoft.Core.CoreModule.loadWasm(["DLR", "DDN", "DCP"]);
Dynamsoft.DLR.LabelRecognizerModule.loadRecognitionData("MRZ");

/**
 * Creates a CameraEnhancer instance for later use.
 */
async function initDCE() {
    view = await Dynamsoft.DCE.CameraView.createInstance();
    cameraEnhancer = await Dynamsoft.DCE.CameraEnhancer.createInstance(view);
    cameraViewContainer.append(view.getUIElement());
}

/**
 * Creates a CaptureVisionRouter instance and configure the task to recognize text.
 * Also, make sure the original image is returned after it has been processed.
 */
let cvrReady = (async function initCVR() {
    await initDCE();
    router = await Dynamsoft.CVR.CaptureVisionRouter.createInstance();
    await router.initSettings("./template.json");
    router.setInput(cameraEnhancer);

    /* Defines the result receiver for the task.*/
    const resultReceiver = new Dynamsoft.CVR.CapturedResultReceiver();
    resultReceiver.onCapturedResultReceived = (result) => {
        const normalizedResults = result.normalizedImageResultItems;
        const recognizedResults = result.textLineResultItems;
        const parsedResults = result.parsedResultItems;

        console.log(normalizedResults);
        console.log(recognizedResults);
        console.log(parsedResults);
        if (normalizedResults && recognizedResults) {
            const needShowNormalizedImage = normalizedResults.filter((dsimage) => {
                if (normalizedResults.length === 1) {
                    return true;
                } else {
                    return dsimage.taskName === "Task_DetectAndNormalizePassport";
                }
            })
            const imageData = Dynamsoft.Utility._getNorImageData(needShowNormalizedImage[0].imageData);
            const normalizedCvs = Dynamsoft.Utility._toCanvas(imageData);
            const needShowTextLines = recognizedResults[0].text;
            parsedResultArea.innerText = "";
            normalizedImageArea.innerText = "";
            normalizedImageArea.appendChild(normalizedCvs);
            const pMrzString = document.createElement("p");
            pMrzString.className = "mrz-string";
            pMrzString.innerText = needShowTextLines;
            parsedResultArea.appendChild(pMrzString);
            if (parsedResults) {
                const parseResultInfo = getNeedShowFields(parsedResults[0]);
                for (let field in parseResultInfo) {
                    const p = document.createElement("p");
                    const spanFieldName = document.createElement("span");
                    spanFieldName.className = "field-name";
                    const spanValue = document.createElement("span");
                    spanValue.className = "field-value";
                    spanFieldName.innerText = `${field} : `;
                    spanValue.innerText = `${parseResultInfo[field] || 'not detected'}`;
                    p.appendChild(spanFieldName);
                    p.appendChild(spanValue);
                    parsedResultArea.appendChild(p);
                }
            } else {
                alert(`Failed to parse the content. The MRZ text ${needShowTextLines}.`);
                parsedResultArea.style.justifyContent = "flex-start";
            }
            resultContainer.style.display = "flex";
            router.stopCapturing();
            view.clearAllInnerDrawingItems();
        }
    };
    await router.addResultReceiver(resultReceiver);
})();

async function startCapturing() {
    try {
        await (promiseCVRReady = promiseCVRReady || (async () => {
            await cvrReady;
            /* Starts streaming the video. */
            await cameraEnhancer.open();
            await router.startCapturing("ReadPassport");
        })());
    } catch (ex) {
        let errMsg = ex.message || ex;
        console.error(errMsg);
        alert(errMsg);
    }
}

function getNeedShowFields(result) {
    const parseResultInfo = {};
    if (!result.exception) {
        let name = result.getFieldValue("name");
        parseResultInfo['Name'] = name;

        let gender = result.getFieldValue("sex");
        parseResultInfo["Gender"] = gender;

        let birthYear = result.getFieldValue("birthYear");
        let birthMonth = result.getFieldValue("birthMonth");
        let birthDay = result.getFieldValue("birthDay");
        if (parseInt(birthYear) > (new Date().getFullYear() % 100)) {
            birthYear = "19" + birthYear;
        } else {
            birthYear = "20" + birthYear;
        }
        let age = new Date().getUTCFullYear() - parseInt(birthYear);
        parseResultInfo["Age"] = age;

        let documentNumber = result.getFieldValue("passportNumber");
        parseResultInfo['Document Number'] = documentNumber;

        let issuingState = result.getFieldValue("issuingState");
        parseResultInfo['Issuing State'] = issuingState;

        let nationality = result.getFieldValue("nationality");
        parseResultInfo['Nationality'] = nationality;

        parseResultInfo['Date of Birth (YYYY-MM-DD)'] = birthYear + "-" + birthMonth + "-" + birthDay;

        let expiryYear = result.getFieldValue("expiryYear");
        let expiryMonth = result.getFieldValue("expiryMonth");
        let expiryDay = result.getFieldValue("expiryDay");
        if (parseInt(expiryYear) >= 60) {
            expiryYear = "19" + expiryYear;
        } else {
            expiryYear = "20" + expiryYear;
        }
        parseResultInfo["Date of Expiry (YYYY-MM-DD)"] = expiryYear + "-" + expiryMonth + "-" + expiryDay;

        let personalNumber = result.getFieldValue("personalNumber");
        parseResultInfo["Personal Number"] = personalNumber;

        let primaryIdentifier = result.getFieldValue("primaryIdentifier");
        parseResultInfo["Primary Identifier(s)"] = primaryIdentifier;

        let secondaryIdentifier = result.getFieldValue("secondaryIdentifier");
        parseResultInfo["Secondary Identifier(s)"] = secondaryIdentifier;
    }
    return parseResultInfo;
}

startScaningBtn.addEventListener("click", startCapturing);
restartVideoBtn.addEventListener("click", async () => {
    resultContainer.style.display = "none";
    await router.startCapturing("ReadPassport");
})