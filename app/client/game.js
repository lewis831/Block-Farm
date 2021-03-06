// JavaScript source code
import { Tracker } from 'meteor/tracker';
import { Session } from 'meteor/session';
import { property_type } from '../imports/collections.js';
import { land_type } from '../imports/collections.js';
import { mission } from '../imports/collections.js';
import { callPromise } from '../imports/promise.js';

var landSize = 3;
var blockSize = 150;
var landSrc = "/img/game/land.svg";

var prefix = "/img/game/plant/";
var postfix = ".svg";

var unlockCropNum = 3;
var unlockCropLevel = 5;

var currentCropId;
var plantMode = false;
var currentLandId;
var placeMode = false;
var currentCropLand;
var audio;

var currentCharacter = "farmer";

var visitNode;
var s_Id;
var x = 0, y = 0;
var currentTutorialSlide = 0;

var gameMode = "Farmer";


const _dep = new Tracker.Dependency;
const _crop = new Tracker.Dependency;

const _character = new Tracker.Dependency;


var cursorX;
var cursorY;

var panelCounter = 2;

var cropList = [];
var stockList = [];
var landList = [];

var cropData = [];
var landData = [];

var staminaList = { crop: 5, steal: 20, stealFail: 40 };

var currentUser = {};

var userLandConfiguration = [];

var showThief = false;

var cropTypeList = [];

var landTypeList = [];

var userCropType = [];


var property_log = [];
var user_property = [];
var property_database = [];
var display_field = [];

var currentClickedCrop = null;
var currentClickedLand = null;
var removeMode = false;

var floatOffset = 1;

var checkMissionInterval = null;
var theifId = 0;
var landInfo = [];
var stealRate;

var tutorialMode = false;
var targetCircleDiv = null;
var ratingOpened = false;
var onchangedIndex = [];

///////////////////////////
//  prototype functions  //
///////////////////////////

Date.prototype.addTime = function (days, hours, minutes, seconds) {
    var dat = new Date();

    dat.setDate(dat.getDate() + days);
    dat.setHours(dat.getHours() + hours);
    dat.setMinutes(dat.getMinutes() + minutes);
    dat.setSeconds(dat.getSeconds() + seconds);

    return dat;
}

gameIndexCreation = async function () {
    await getStakeholderId();
    await fetchAllCropTypes();
    await getUserData(s_Id);
    await getLandConfiguration(s_Id);
    await loadCropList(s_Id);
    await getUserStockList(s_Id);
    await fetchGameInitConfig(s_Id);

}

getStakeholderId = function () {
    if (Session.get("id") == null) {
        sweetAlert("Oops...", "Please Register First", "error");
        Router.go('/');
        return;
    }
}

gameIndexRend = function () {
    $(".levelUp").hide();
    get_user_property();

    updateUserExp(0);
    updateSyndicateExp(0);
    updateStaminaBar(0);

    initCropLand(s_Id);
    showConfirmation(s_Id);

    Session.set('userName', currentUser.name);
    Session.set('userExp', currentUser.exp);
    Session.set('userSta', currentUser.sta);
    Session.set('userCharacter', currentUser.type);
    Session.set('userLevel', currentUser.level);
    Session.set('SyndicateLevel', currentUser.SyndicateLevel);


    setInterval(cropSummaryUpdate, 1000);
    setInterval(updateUserStamina, 500);

    loading(0);

    if (currentUser.level == 0) {
        $(".tutorialContainer").fadeIn();
    }
}

/////////////////
//  onCreated  //
/////////////////

Template.gameIndex.created = function () {
    createDBConnection();
    checkDBLoaded(async function (value) {
        var id = Meteor.userId();
        if (id) {
            Session.set("id", id);
        } else {

            swal({
                title: "Oops...",
                text: "You have to login first!",
                type: "warning",
                showCancelButton: false
            },
                function () {
                    Router.go('/');
                });
        }
        await gameIndexCreation();
        await gameIndexRend();

        //eventListener();
        audio = new Audio('/music/background_music.mp3');
        //audio.play();
    });
}

//////////////////
//  onRendered  //
//////////////////

Template.gameIndex.rendered = function () {
    if (!this._rendered) {
        $(window).resize(function (evt) {
            initCropLand(s_Id);
        });
    }
}


Template.shop.rendered = function () {

}

//////////////////
//    onLeave   //
//////////////////

$(window).on("beforeunload", function () {
    Meteor.call('updateStakeholderLastLogin', new Date());
    Meteor.call('updateUserStamina', currentUser.sta);
    // CongressInstance.updateStakeholderLastLogin(s_Id, new Date(), { from: web3.eth.accounts[currentAccount], gas: 2000000 });
    // CongressInstance.updateUserStamina(s_Id, currentUser.sta, { from: web3.eth.accounts[currentAccount], gas: 2000000 });

    console.log("Porgress Saved");
    return true ? "Do you really want to close?" : null;
})

///////////////
//  Helpers  //
///////////////

Template.shop.helpers({

});

Template.gamingArea.helpers({
    currentLevel: function () {
        _character.depend();
        return Session.get('Levelup');
    },
    staminaCap: function () {
        return "Stamina Capacity: " + Session.get('staminaCap');
    },
    expCap: function () {
        return "Exp Capacity: " + Session.get('expCap');
    },
    unlockCrop: function () {
        if ((Session.get('userLevel') % 5) == 0) {
            if (previousUnlockCrop != Session.get('unlockCrop')) {
                previousUnlockCrop = Session.get('unlockCrop');
                return "Unlock Crop: " + cropTypeList[Session.get('unlockCrop')].name;
            }
        }
        else {
            return "";
        }
    }
});

Template.characterList.helpers({
    userLevel: function () {
        return "LV. " + Session.get('userLevel');
    },
    userSyndicateLevel: function () {
        return "LV. " + Session.get('SyndicateLevel');
    },
    userName: function () {
        return Session.get('userName');
    },
    characterType: function () {
        if (Session.get('userCharacter') == "Thief") {
            return "/img/game/thief.svg";
        } else {
            return "/img/game/guard.svg";

        }
    },
    characterTypeName: function () {
        return Session.get('userCharacter');
    },
    expTip: function () {
        return currentUser.Exp + "/" + levelCap(currentUser.level);
    },
    staTip: function () {
        return currentUser.sta + "/" + staminaCap(currentUser.level);
    },
    expSyndicate: function () {
        return currentUser.SyndicateExp + "/" + SyndicateLevelCap(currentUser.SyndicateLevel);
    },
});

Template.statusList.helpers({
    crops: function () {
        try {
            var _cropTypeList = Session.get('cropTypeList');
            var cropsData = [];
            for (var i = 0; i < _cropTypeList.length; i++) {
                var data = _cropTypeList[i];

                cropsData.push({
                    "name": "crop plantButton property" + i,
                    "img": prefix + data.img[3] + postfix,
                    "content": data.name
                });
            }
            _crop.depend();
            return cropsData;
        }
        catch (e) {

        }
    },
    lands: function () {
        try {
            var landsData = [];
            var _landTypeList = Session.get('landTypeList');
            for (var i = 0; i < _landTypeList.length; i++) {
                var data = _landTypeList[i];

                landsData.push({
                    "name": "cropLand farmLand" + data.id,
                    "img": prefix + data.img + postfix,
                    "content": data.name
                });
            }
            return landsData;
        }
        catch (e) { }
    },
});

//////////////
//  Events  //
//////////////
Template.advTutorial.events({
    // 'click .gameGuideImg':function(event){
    //   // $('.landList');
    //   $('.advTutorialContainer').css("background","rgba(255, 255, 255, 1)");
    // },
});

Template.firstTutorial.events({
    'click .tutorialNextBtn': function (event) {
        currentTutorialSlide -= 100;
        $(".tutorialContainer").css("transform", "translateX(" + currentTutorialSlide + "vw)");
    },
    'click .tutorialPreviousBtn': function (event) {
        currentTutorialSlide += 100;
        $(".tutorialContainer").css("transform", "translateX(" + currentTutorialSlide + "vw)");
    },
    'click .tutorialFinishBtn': function (event) {
        $(".tutorialContainer").css("opacity", "0");
        currentTutorialSlide = 0;
        setTimeout(function () {
            $(".tutorialContainer").css("display", "none");

        }, 1000);
    },
    'click .tutorialSkipBtn': function (event) {
        $(".tutorialContainer").css("opacity", "0");
        currentTutorialSlide = 0;
        setTimeout(function () {
            $(".tutorialContainer").css("display", "none");

        }, 1000);
    }
});

Template.shop.events({
    'click #btn_show_property': function () {
        set_propertyType_table();
    },
    'click #btn_shop_close': function () {
        $('.property_shop').css('display', 'none');
    },
    'mouseenter input[type="range"]': function (e) {
        var r = $(e.target);

        var p = r.val();
        r.on('click', function () {
            p = r.val();
            bg(p);
        });
        r.on('mousemove', function () {
            p = r.val();
            bg(p);
        });

        function bg(n) {
            r.css({ 'background-image': '-webkit-linear-gradient(left ,#82cbd1 0%,#82cbd1 ' + n + '%,#C7FFEF ' + n + '%, #C7FFEF 100%)' });
        }
    },
    'click #btn_property_save': function () {
        save_rating_setting();
        $('.property_shop').css('display', 'none');
    },
    'click #btn_property_cancel': function () {
        set_propertyType_table();
    }
});


Template.gameIndex.events({
    'click .cropObject': function (event) {
        if (currentCropId != null && plantMode) {
            var _landId = currentCropLand.split("cropLand")[1];

            if (userLandConfiguration[_landId].crop != -1) {
                sweetAlert("Oops...", "Don't plant twice !", "error");
                return;
            } else if (userLandConfiguration[_landId].land == -1) {
                sweetAlert("Oops...", "You need a land first !", "error");
                return;
            } else if (currentUser.sta < staminaList["crop"]) {
                sweetAlert("Oops...", "Not enough stamina", "error");
                return;
            }

            updateStaminaBar(staminaList["crop"]);

            var styles = {
                'z-index': "2",
                'opacity': 1
            };
            $(".cropObject").clone().attr("class", "croppedObject croppedObject" + cropList.length).attr("cropcount", cropTypeList[currentCropId].count).appendTo(".surfaceObject").css(styles);

            var start = new Date();
            var end = new Date();

            var cropWaitingTime = cropTypeList[currentCropId].time.split(".");

            end = end.addTime(parseInt(cropWaitingTime[0]), parseInt(cropWaitingTime[1]), parseInt(cropWaitingTime[2]), parseInt(cropWaitingTime[3]));

            var _id = cropList.length;

            userLandConfiguration[_landId].crop = _id;
            Meteor.call('updateUserLandConfiguration', _landId, _id, 0, 'crop');
            //GamePropertyInstance.updateUserLandConfiguration(s_Id, _landId, _id, 0, 'crop', {from:web3.eth.accounts[currentAccount], gas:2000000});
            Meteor.call('addCropList', cropTypeList[currentCropId].name, cropTypeList[currentCropId].img[3], start, end, parseInt(cropTypeList[currentCropId].id), 0, parseInt(cropTypeList[currentCropId].count));
            //GamePropertyInstance.addCropList(s_Id, cropTypeList[currentCropId].name, cropTypeList[currentCropId].img[3], start, end, parseInt(cropTypeList[currentCropId].id), 0, parseInt(cropTypeList[currentCropId].count), {from:web3.eth.accounts[currentAccount], gas:2000000});
            cropList.push({
                id: _id,
                name: cropTypeList[currentCropId].name,
                img: cropTypeList[currentCropId].img[3],
                start: start,
                end: end,
                type: cropTypeList[currentCropId].id,
                ripe: 0,
                count: cropTypeList[currentCropId].count
            });
            _dep.changed();
        } else {
            sweetAlert("Oops...", "Please specify Crop first", "error");
            return;
        }
    },
    'click .farmObject': function (event) {
        if (currentLandId != null && placeMode) {
            var _landId = currentCropLand.split("cropLand")[1];

            if (userLandConfiguration[_landId].land != -1) {
                sweetAlert("Oops...", "Don't plow twice !", "error");
                return;
            }
            landTypeList[currentLandId].count++;
            currentCropLand = currentCropLand.split(" ")[1];
            $(".farmObject").children().clone().appendTo("." + currentCropLand).css({ opacity: 1 });
            $("." + currentCropLand).css({ "border-style": "none" });
            var _id = landList.length;
            userLandConfiguration[_landId].land = landTypeList[currentLandId].id;
            Meteor.call('updateUserLandConfiguration', _landId, -1, landTypeList[currentLandId].id, 'land');
            //GamePropertyInstance.updateUserLandConfiguration(s_Id, _landId, -1, landTypeList[currentLandId].id, 'land', {from:web3.eth.accounts[currentAccount], gas:2000000});

            landList.push({
                id: _id,
                name: landTypeList[currentLandId].name,
                img: landTypeList[currentLandId].img,
            });

        } else {
            sweetAlert("Oops...", "Specify Land first", "error");
            return;
        }
    },
    'click .thief': function (event) {
        $(event.target).parent().css({ opacity: 0, transform: "translateY(50px)" });
        landInfo[$(event.target).parent().attr('bindindex')].showed = 0;
        updateSyndicateExp(2);
        currentUser.SyndicateProgress -= 1;
        Meteor.call('updateSyndicateProgress', currentUser.SyndicateProgress);
        //CongressInstance.updateSyndicateProgress(s_Id, currentUser.SyndicateProgress, { from: web3.eth.accounts[currentAccount], gas: 2000000 });
        setTimeout(function () {
            $(event.target).parent().remove();
        }, 1000);
        if (currentUser.SyndicateProgress <= 0) {
            clearInterval(checkMissionInterval);
            var leftThieives = $('.thief').length;
            for (i = 0; i < leftThieives; i++) {
                $('.thief:eq(' + i + ')').css({ opacity: 0, transform: "translateY(50px)" });
                $('.thief:eq(' + i + ')').remove();
            }
            Meteor.call('updateFarmerId', 0);
            //CongressInstance.updateFarmerId(s_Id, 0, { from: web3.eth.accounts[currentAccount], gas: 2000000 });
            updateSyndicateExp(30);
            sweetAlert("Congratulations!", "Mission Completed!", "success");

        }
    },
    'click .croppedObject': function (event) {
        var id, cropClass, cropCount;

        if (event.target.className == "") {
            cropClass = $(event.target).parent().prop('className').split(" ")[1];
            id = cropClass.split("croppedObject")[1];
        } else {
            cropClass = event.target.className.split(" ")[1];
            id = cropClass.split("croppedObject")[1];
        }

        cropCount = $(event.target).parent().attr("cropcount");

        var typeIndex;
        for (var j = 0; j < cropTypeList.length; j++) {
            if (cropTypeList[j].id == cropList[id].type) {
                typeIndex = j;
            }
        }

        $(".floatCropStatus").css("display", "none");

        if (gameMode == "Farmer") {
            if (cropList[id].ripe) {
                var imgs = $(".crop").find("img");

                for (var i = 0; i < imgs.length; i++) {
                    if ($(imgs[i]).parent().data('pressed')) {
                        $(imgs[i]).parent().data('pressed', false);
                        $(imgs[i]).parent().html("<img src = '" + prefix + cropTypeList[i].img[3] + postfix + "' />" + cropTypeList[i].name);
                    }
                }
                $(".animationImg").html("<img src = '" + prefix + cropTypeList[typeIndex].img[3] + postfix + "' />");

                var difference = elapsedTime(cropList[id].start, cropList[id].end);
                var exp = Math.floor((difference / (1000 * 30)) * 20);
                updateUserExp(exp);
                $(".scoreObject").html("+" + exp + "XP");

                var temp2 = $(".expPopText").clone().attr("class", "expPopTextTemp").appendTo(".expProgress");

                temp2.html("+" + exp + "XP");
                temp2.css({ display: "inline", opacity: 1, transform: "translateY(0px)" });

                setTimeout(function () {
                    temp2.css({ opacity: 0, transform: "translateY(10px)" });
                    setTimeout(function () {
                        temp2.css({ display: "none" });
                    }, 2000);
                }, 1000);

            } else {
                sweetAlert("Oops...", "Patience is a virtue <3", "error");
                return;
            }

            var top = $(event.target)[0].getBoundingClientRect().top;
            var left = $(event.target)[0].getBoundingClientRect().left;

            var landTop = ($(".canvas").height() - $(window).height()) / 2;
            var landLeft = ($(".canvas").width() - $(window).width()) / 2;

            var areaLeft = $(".gamingArea").position().left;
            var resizeOffsetX = (screen.width - $(window).width()) / 6.5;

            var divHeight = $(".cropObject").height() / 5;
            var divWidth = $(".cropObject").width() * 1.65;

            var posX = left + landLeft - areaLeft + divWidth - x - resizeOffsetX;
            var posY = top + landTop - divHeight - y;

            var temp = $(".animationObject").clone().attr("class", "animationTemp").appendTo(".canvas");
            temp.css({ display: "inline", top: posY, left: posX });
            temp.addClass("animationTempShow");

            setTimeout(function () {
                temp.css({ opacity: 0, transform: "translateY(0px)" });
                setTimeout(function () {
                    temp.css({ display: "none" });
                    temp.remove();
                }, 1000);
            }, 1000);

            var stockId = stockList.length;
            stockList.push({
                id: stockId,
                name: cropList[id].name,
                minUnit: 1,
                extraData: cropList[id].name,
                type: cropList[id].type,
                count: cropCount,
                tradeable: 0
            });
            var p_Id;
            for (var i = 0; i < user_property.length; i++) {
                if (user_property[i].propertyType == stockList[stockId].type) {
                    p_Id = i;
                    user_property[i].propertyCount += parseInt(stockList[stockId].count);
                    break;
                }
            }

            var configId;
            for (var i = 0; i < userLandConfiguration.length; i++) {
                if (userLandConfiguration[i].crop == id) {
                    userLandConfiguration[i].crop = -1;
                    configId = i;
                }
            }
            Meteor.call('updateUserLandConfiguration', configId, -1, 0, 'crop');
            //GamePropertyInstance.updateUserLandConfiguration(s_Id, configId, -1, 0, 'crop', {from:web3.eth.accounts[currentAccount], gas:2000000});

            cropList[id].name = 0;
            cropList[id].img = 0;
            cropList[id].start = 0;
            cropList[id].end = 0;
            cropList[id].type = 0;
            cropList[id].ripe = 0;
            Meteor.call('updateCropList', id, 0, 0, 0, 0, 0, 0, 0);
            //GamePropertyInstance.updateCropList(s_Id, id, 0, 0, 0, 0, 0, 0, 0, {from:web3.eth.accounts[currentAccount], gas:2000000});

            $("." + cropClass).remove();
            Meteor.call('updatePropertyCount', p_Id, parseInt(stockList[stockId].count), function () {
                //reload propertyTable
                set_property_table();
            });
            //usingPropertyInstance.updatePropertyCount_Cropped(propertyIndex, parseInt(stockList[stockId].count), {from:web3.eth.accounts[currentAccount], gas:3000000});


        }
        else if (gameMode == "Thief") {
            if (currentUser.sta < staminaList["steal"]) {
                sweetAlert("Oops...", "Not enough stamina", "error");
                return;
            }
            else {
                var stolenFlag, stealCount, judgement, stealResult;
                stolenFlag = $(event.target).parent().attr("stolenFlag");
                if ((cropList[id].ripe) && (stolenFlag == "f")) {
                    judgement = Math.random();
                    if (judgement >= stealRate) {
                        stealResult = true;

                        $(".animationImg").html("<img src = '" + prefix + cropTypeList[typeIndex].img[3] + postfix + "' />");
                        $(".scoreObject").html("+" + 5 + "XP");
                        updateStaminaBar(staminaList["steal"]);
                        updateSyndicateExp(5);

                        var landTop = ($(".canvas").height() - $(window).height()) / 2;
                        var landLeft = ($(".canvas").width() - $(window).width()) / 2;

                        var areaLeft = $(".gamingArea").position().left;
                        var resizeOffsetX = (screen.width - $(window).width()) / 6.5;

                        var divHeight = $(".cropObject").height() / 5;
                        var divWidth = $(".cropObject").width() * 1.65;
                        var posX = cursorX + landLeft - areaLeft + divWidth - x - resizeOffsetX;
                        var posY = cursorY + landTop - divHeight - y;
                        posX = cursorX + posX;
                        posY = cursorY + posY;


                        var temp = $(".animationObject").clone().attr("class", "animationTemp").appendTo(".canvas");
                        temp.css({ display: "inline", top: posY, left: posX });
                        temp.addClass("animationTempShow");

                        setTimeout(function () {
                            temp.css({ opacity: 0, transform: "translateY(0px)" });
                            setTimeout(function () {
                                temp.css({ display: "none" });
                                temp.remove();
                            }, 1000);
                        }, 1000);
                        stealCount = Math.round(cropCount / 2);
                        cropCount = cropCount - stealCount;
                        var p_Id;
                        for (var i = 0; i < user_property.length; i++) {
                            if (user_property[i].propertyType == cropList[id].type) {
                                p_Id = user_property.id;
                                user_property[i].propertyCount += parseInt(cropCount);
                                break;
                            }
                        }
                        Meteor.call('updatePropertyCount', p_Id, stealCount);
                        Meteor.call('updateCropCount', visitNode, id, cropCount);
                        // usingPropertyInstance.updatePropertyCount_Cropped(propertyIndex, stealCount, { from: web3.eth.accounts[currentAccount], gas: 2000000 });
                        // usingPropertyInstance.updateCropCount(visitNode, id, cropCount, { from: web3.eth.accounts[currentAccount], gas: 2000000 });
                        $(event.target).parent().attr("cropcount", parseInt(cropCount));
                        $(event.target).parent().attr("stolenFlag", "t");

                        $("." + cropClass).html("<img src = '" + prefix + cropTypeList[typeIndex].img[4] + postfix + "' />");
                        //reload propertyTable
                        set_property_table();
                    }
                    else {
                        stealResult = false;
                        sweetAlert("Oops...", "You are under arrest!", "warning");
                        updateStaminaBar(staminaList["stealFail"]);
                    }
                    Meteor.call('updateStealRecord', stealResult);
                    // CongressInstance.updateStealRecord(s_Id, stealResult, { from: web3.eth.accounts[currentAccount], gas: 2000000 });
                }
                else {
                    sweetAlert("Oops...", "Don't be so greedy", "error");
                    return;
                }
            }
        }
        else if (gameMode == "Guard") {
        }
    },

    'click .farm img': function (event) {
        if (removeMode) {
            var parentClass = $(event.target).parent()[0].className;
            var _landId = parentClass.split("cropLand")[1];

            if (userLandConfiguration[_landId].land == -1) {
                sweetAlert("Oops...", "Its already empty !", "error");
                return;
            }

            $($(event.target).parent()[0]).css("border", "1px solid black");
            $(event.target).remove();

            userLandConfiguration[_landId].land = -1;
            Meteor.call('updateUserLandConfiguration', _landId, -1, -1, 'land');
            //GamePropertyInstance.updateUserLandConfiguration(s_Id, _landId, -1, -1, 'land', { from: web3.eth.accounts[currentAccount], gas: 2000000 });
        }
    },
    'mouseenter .croppedObject img': function (event) {
        $(".floatCropStatus").css("display", "inline");
        var cropId = $(event.target).parent()[0].className.split("croppedObject")[2];

        var posX = cursorX;
        var posY = cursorY;

        $(".floatCropStatus").css({ display: "inline", top: posY, left: posX });
        $(".floatCropName").html(cropList[cropId].name);

        var difference = elapsedTime(new Date(), cropList[cropId].end);
        var diffData = (difference.getHours() - 8) + ' Hrs. ' + difference.getMinutes() + ' Mins. ' + difference.getSeconds() + " Secs";

        if (cropList[cropId].ripe) {
            $(".timeLeft").html("Ready to harvest");
        } else {
            $(".timeLeft").html(diffData);
        }

        $(".timeLeft").attr("class", "timeLeft timeLeft" + cropId);

        var index;
        for (var j = 0; j < cropTypeList.length; j++) {
            if (cropTypeList[j].id == cropList[cropId].type) {
                index = j;
            }
        }
        $(".floatCropStatus").find("img").attr("src", prefix + cropTypeList[index].img[3] + postfix);
    },
    'mouseout .croppedObject img': function (event) {
        $(".floatCropStatus").css("display", "none");
    },
})

Template.crop.events({
    'click .crop': function (event) {
        clickTarget = null;
        if (event.target.className == "") {
            clickTarget = $(event.target).parent();
        } else {
            clickTarget = $(event.target);
        }
        var imgs = $(".cropLand").find("img");
        $(".farmObject").css("display", "none");
        $(imgs[0]).parent().data('pressed', false);
        $(imgs[0]).parent().html("<img src = '" + prefix + "land" + postfix + "' />" + "Dirt");
        $(imgs[1]).parent().data('pressed', false);
        $(imgs[1]).parent().html("<img src = '/img/game/background.svg' />Grass");
        placeMode = false;
        removeMode = false;

        var id = clickTarget[0].className.split("property")[1];

        if (clickTarget.data('pressed')) {
            $(".cropObject").css("display", "none");
            clickTarget.html("<img src = '" + prefix + cropTypeList[id].img[3] + postfix + "' />" + cropTypeList[id].name);
            clickTarget.data('pressed', false);
            plantMode = false;
            return;
        }

        plantMode = true;

        currentClickedCrop = clickTarget;
        var imgs = $(".crop").find("img");

        for (var i = 0; i < imgs.length; i++) {
            if ($(imgs[i]).parent().data('pressed')) {
                $(imgs[i]).parent().data('pressed', false);
                $(imgs[i]).parent().html("<img src = '" + prefix + cropTypeList[i].img[3] + postfix + "' />" + cropTypeList[i].name);
            }
        }
        clickTarget.data('pressed', true);

        $(".cropObject").html("<img src = '" + prefix + cropTypeList[id].img[0] + postfix + "' />");
        currentCropId = id;

        $(".cropObject").css("display", "inline");
        clickTarget.html("<img src='/img/game/cancel2.svg' width='50%'>");
    },

})

Template.land.events({
    'click .cropLand ': function (event) {
        clickTarget = null;
        if (event.target.className == "") {
            clickTarget = $(event.target).parent();
        } else {
            clickTarget = $(event.target);
        }

        if (plantMode) {
            $(".cropObject").css("display", "none");
            for (var k = 0; k < cropTypeList.length; k++) {
                $('.crop:nth-child(' + (k + 1) + ')').data('pressed', false);
                $('.crop:nth-child(' + (k + 1) + ')').html("<img src = '" + prefix + cropTypeList[k].img[3] + postfix + "' />" + cropTypeList[k].name);
            }
            plantMode = false;
        }

        var id = clickTarget[0].className.split("farmLand")[1];

        if (clickTarget.data('pressed')) {
            $(".farmObject").css("display", "none");
            clickTarget.html("<img src = '" + prefix + landTypeList[id].img + postfix + "' />Dirt");
            clickTarget.data('pressed', false);
            placeMode = false;
            return;
        }
        else {
            placeMode = true;
            clickTarget.data('pressed', true);
        }
        removeMode = false;

        var imgs = $(".cropLand").find("img");
        $(imgs[1]).parent().data('pressed', false);
        $(imgs[1]).parent().html('<img src="/img/game/background.svg">Grass');

        $(".farmObject").html("<img src = '" + prefix + landTypeList[id].img + postfix + "' />");
        currentLandId = id;

        if (placeMode) {
            $(".farmObject").css("display", "inline");
            clickTarget.html("<img src='/img/game/cancel2.svg' width='50%'>")
            currentClickedLand = clickTarget;
        } else {
            $(currentClickedLand).html("<img src = '" + prefix + landTypeList[id].img + postfix + "' />Dirt");
            clickTarget.html("<img src = '" + prefix + landTypeList[id].img + postfix + "' />Dirt");
            $(".farmObject").css("display", "none");
        }
    },

})

Template.gamingArea.events({
    'mouseenter .land div': function (event) {
        if (plantMode) {
            currentCropLand = event.target.className;

            var top = $(event.target)[0].getBoundingClientRect().top;
            var left = $(event.target)[0].getBoundingClientRect().left;

            var landTop = ($(".canvas").height() - $(window).height()) / 2;
            var landLeft = ($(".canvas").width() - $(window).width()) / 2;

            var resizeOffsetX = ($(window).width() - 400) / 6.5;
            var areaLeft = $(".gamingArea").position().left;
            var divHeight = $(".cropObject").height() / 5;
            var divWidth = $(".cropObject").width() / 1.65;

            var posX = left + landLeft - areaLeft + divWidth - x + resizeOffsetX;

            var posY = top + landTop - divHeight - y;

            var styles = {
                top: posY,
                left: posX,
                width: "150px",
                height: "150px",
                position: "absolute",
                opacity: 0.5,
                "z-index": 2
            };

            $(".cropObject").css(styles);

        } else if (placeMode) {
            currentCropLand = event.target.className;
            var top = $(event.target)[0].getBoundingClientRect().top;
            var left = $(event.target)[0].getBoundingClientRect().left;

            var landTop = ($(".canvas").height() - $(window).height()) / 2;
            var landLeft = ($(".canvas").width() - $(window).width()) / 2;

            var resizeOffsetX = ($(window).width() - 400) / 6.5;
            var areaLeft = $(".gamingArea").position().left;
            var divHeight = $(".cropObject").height() / 10;
            var divWidth = $(".cropObject").width() / 1.75;

            var posX = left + landLeft - areaLeft + divWidth - x + resizeOffsetX;

            var posY = top + landTop - divHeight - y;

            $(".farmObject").css({ top: posY, left: posX, width: "150px", height: "150px", position: "absolute", opacity: 0.5 });
        }

    },
    'click .matchesBtn': function (event) {
        //matchmakingbug
        var m_Id = $(event.target).attr("class").split("matchBtn")[1];
        MainActivity2Instance.updateConfirmation(m_Id, s_Id, 1, { from: web3.eth.accounts[currentAccount], gas: 2000000 });

        $(event.target).prop("value", "Waiting");
        $(event.target).prop("disabled", true);
    },
    // 'click .zoom':function(event){
    //     var data = $(".canvas").css("transform");
    //     var scale;
    //     if (data == 'none'){
    //       scale = 1;
    //     }else{
    //       var values = data.split('(')[1];
    //       values = values.split(')')[0];
    //       values = values.split(',');
    //
    //       var a = values[0];
    //       var b = values[1];
    //
    //       scale = Math.sqrt(a*a + b*b);
    //       console.log(scale);
    //     }
    //     console.log(scale);
    //
    //
    //
    //     if (event.target.className.split(" ")[1] == 'zoomin' && scale < 1.5){
    //         scale += 0.1;
    //     }else if (event.target.className.split(" ")[1] == 'zoomout' && scale > 0.5){
    //         scale -= 0.1;
    //
    //     }
    //     $(".canvas").css("transform", "scale(" + scale + ")");
    //
    // }
    'click .nav': function (event) {
        var moveSpeed = 30;
        var data = $(".canvas").css('-webkit-transform');
        var negativeBoundary = -900;
        var boundary = 900;

        if (data == 'none') {
            x = 0;
            y = 0;
        } else {
            data = data.split(/[()]/)[1];
            x = parseInt(data.split(',')[4]);
            y = parseInt(data.split(',')[5]);
        }

        if (event.target.className.split(" ")[1] == 'navUp' && y < boundary) {
            y += moveSpeed;
        } else if (event.target.className.split(" ")[1] == 'navDown' && y > negativeBoundary) {
            y -= moveSpeed;
        } else if (event.target.className.split(" ")[1] == 'navLeft' && x < boundary) {
            x += moveSpeed;
        } else if (event.target.className.split(" ")[1] == 'navRight' && x > negativeBoundary) {
            x -= moveSpeed;
        }
        $('.canvas').css('-webkit-transform', 'translateX(' + x + 'px) translateY(' + y + 'px)');
    },
    'click .musicSwitch': function (event) {
        if (!audio.paused) {
            audio.pause();
            $(".musicSwitch").find("img").attr("src", "/img/game/speaker_off.svg");
        } else {
            audio.play();
            $(".musicSwitch").find("img").attr("src", "/img/game/speaker_on.svg");
        }
    },
    'click .gameGuideImg': function (event) {
        // display original tutorial
        // $(".tutorialContainer").css("opacity", "1");
        // $(".tutorialContainer").css("display", "inline");
        // $(".tutorialContainer").css("transform", "translateX("+ (0) +"vw)");

        // display cover color tutorial
        // $('.advTutorialContainer').css("display","inline");
        // $('.advTutorialContainer').css("background","rgba(255, 255, 255, 0.7)");
        // $('.advTutorialContainer').css("z-index","100");
        // $('.landList').css("z-index","101");

        tutorialMode = true;
        targetCircleDiv = $('.cropLand');
        $('.cropLand0').css("-webkit-animation", "circleLandAnimation 1s infinite");
        createCircle();
        // createCircle($('.cropLand0'));
        // createCircle($('.characterStatus'));
    },
})
// for create tutorial highlight circle by the div class
function createCircle() {
    if (!tutorialMode) {
        return;
    }
    var topT = targetCircleDiv[0].getBoundingClientRect().top;
    var leftT = targetCircleDiv[0].getBoundingClientRect().left;
    var heightT = targetCircleDiv.height();
    var widthT = targetCircleDiv.width();
    console.log(topT + "," + leftT + "," + heightT + "," + widthT);
    // top: topT-heightT/4.5,
    // left: leftT-widthT/7.5,
    var cricleStyle = {
        top: topT - (0.25 * heightT),
        left: leftT - ((1.5 * heightT - widthT) / 2),
        width: heightT * 1.5,
        height: heightT * 1.5,
        position: "absolute",
        opacity: 1,
        "border": "2px solid rgb(255, 31, 0)",
        "border-radius": "99em",
        "z-index": 99,
        "-webkit-animation": "circleCorlorAnimation 1s infinite"
    };
    $('.guideCircleStatus').css(cricleStyle);
    console.log(leftT);
    createTip(topT, leftT, heightT, widthT);
}
function createTip(_cTop, _cLeft, _cHeight, _cWidth) {
    var tipStyle = {
        position: "absolute",
        opacity: 1,
        top: _cTop + (_cHeight / 3),
        left: _cLeft + (_cWidth * 5 / 4),
        // width:"100px",
        // height:"100px",
        padding: "20px",
        "border-radius": "15px",
        "background-color": "rgb(255, 255, 255)",
        "z-index": 120,
    };
    $('.guideCircleText').css(tipStyle);
    $('.guideCircleText').text("123");
}
function tipContent() {

}

function PanelControl(panelIndex) {
    $(".statusPanel:nth-child(" + panelCounter + ")").removeClass("statusPanelShow");
    $(".statusPanel:nth-child(" + panelCounter + ")").css("z-index", -1);
    $(".crop" + panelCounter).css("background-color", "rgba(255,255,255,0.45)");

    $(".crop" + panelIndex).css("background-color", "rgba(255,255,255,0.65)");
    $(".statusPanel:nth-child(" + panelIndex + ")").css("z-index", 100);
    $(".statusPanel:nth-child(" + panelIndex + ")").addClass("statusPanelShow");
    panelCounter = panelIndex;

    if (panelCounter == 3) {
        set_property_table();
    }

    $(".cropObject").css("display", "none");
    $(".farmObject").css("display", "none");

    initAllBtns();
}

Template.statusList.events({
    'click .crop2': function () {
        PanelControl(2);
    },
    'click .crop3': function () {
        PanelControl(3);
    },
    'click .removeLand': function (event) {
        clickTarget = null;
        $(".farmObject").css("display", "none");
        if (plantMode) {
            $(".cropObject").css("display", "none");
            for (var k = 0; k < cropTypeList.length; k++) {
                $('.crop:nth-child(' + (k + 1) + ')').html("<img src = '" + prefix + cropTypeList[k].img[3] + postfix + "' />" + cropTypeList[k].name);
                $('.crop:nth-child(' + (k + 1) + ')').data('pressed', false);
            }
            plantMode = false;
        }

        if (event.target.className == "") {
            clickTarget = $(event.target).parent();
        } else {
            clickTarget = $(event.target);
        }

        if (clickTarget.data('pressed')) {

            clickTarget.html("<img src='/img/game/background.svg'>Grass")
            clickTarget.data('pressed', false);
            removeMode = false;
            return;
        }
        else {
            removeMode = true;
        }
        var imgs = $(".cropLand").find("img");
        $(imgs[0]).parent().data('pressed', false);
        $(imgs[0]).parent().html('<img src="/img/game/plant/land.svg">Dirt');

        clickTarget.data('pressed', true);

        if (removeMode) {
            clickTarget.html("<img src='/img/game/cancel2.svg' width='50%'>");

        } else {
            clickTarget.html("<img src='/img/game/background.svg'>Grass");
        }
    },
    'click #btn_tradeable_save': function () {
        save_tradable_setting();
    },
    'click #btn_tradeable_cancel': function () {
        sweetAlert("Warning", 'cancel', "warning");
        set_property_table();
    },
    'click .test': function (event) {
        var lvlCap = levelCap(currentUser.level);
        currentUser.exp = lvlCap;
        currentUser.totalExp += currentUser.exp;
        updateUserExp(0);
    },
    'click .matchmaking': function (event) {
        //matchmakingbug
        MainActivityInstance.findOrigin({ from: web3.eth.accounts[1], gas: 5000000 });
        updateUserData(s_Id);
        showConfirmation(s_Id);
    },
    'click .confirmMatches': function (event) {
        //matchmakingbug
        MainActivity2Instance.checkConfirmation({ from: web3.eth.accounts[0], gas: 2000000 });
        updateUserData(s_Id);
        showConfirmation(s_Id);
    },
    'click .nextHome': function (event) {
        loading(1);
        visitNode = getVisitNode();
        setStealRate(visitNode);
        rerenderCropLand(visitNode);
        loading(0);
    },
})

Template.characterList.events({
    'click .characterImg': function (event) {
        loading(1);
        if (currentCharacter == "farmer") {
            if (Session.get('userCharacter') == "Thief") {
                PanelControl(3);
                visitNode = getVisitNode();
                setStealRate(visitNode);
                rerenderCropLand(visitNode);
                $('.SyndicateExp').css('visibility', 'visible');
                $('.userExp').css('visibility', 'collapse');
                $('.nextSwitch').append($('<input></input>', {
                    type: 'image', //type:'button',
                    name: 'button',
                    class: 'nextHome',
                    value: 'Next',
                    src: '/img/game/nextHome.svg'
                }));

                gameMode = "Thief";
                $('.crop2').css('display', 'none');
                currentCharacter = "thief";
                loading(0);
            }
            else if (Session.get('userCharacter') == "Guard") {
                //matchmakingbug
                var gaurdMatchID = CongressInstance.getGuardMatchId.call(s_Id, { from: web3.eth.accounts[currentAccount] }).c[0];
                var matchLength = MainActivity2Instance.getMatchMakingLength.call(s_Id, { from: web3.eth.accounts[currentAccount] }).c[0];
                var matchDiff = matchLength - gaurdMatchID;
                matchDiff = 3;
                if (matchDiff <= 2) {
                    var guardData = CongressInstance.getGuardReqInfo.call(s_Id, { from: web3.eth.accounts[currentAccount] });
                    var guardLand = guardData[0].c[0];
                    var progress = guardData[1].c[0];
                    if (guardLand == 0) {
                        sweetAlert("Oops...", "You have completed your mission.", "error");
                        loading(0);
                        return;
                    }
                    else {
                        PanelControl(3);
                        showThief = true;

                        $('.SyndicateExp').css('visibility', 'visible');
                        $('.userExp').css('visibility', 'collapse');
                        $(".front img").prop('src', "/img/game/guard.svg");
                        $(".back img").prop('src', "/img/game/farmer.svg");
                        if (progress == 0) {
                            progress = thiefNumber(currentUser.SyndicateLevel);
                            currentUser.SyndicateProgress = progress;
                            Meteor.call('updateSyndicateProgress', progress);
                            // CongressInstance.updateSyndicateProgress(s_Id, progress, { from: web3.eth.accounts[currentAccount], gas: 2000000 });
                        }

                        PanelControl(3);
                        showThief = true;
                        rerenderCropLand(guardLand);
                        gameMode = "Guard";
                        $('.SyndicateExp').css('visibility', 'visible');
                        $('.userExp').css('visibility', 'collapse');
                        $('.crop2').css('display', 'none');
                        landInfo = [];
                        for (var i = 0; i < userLandConfiguration.length; i++) {
                            var top = $('.cropLand' + i)[0].getBoundingClientRect().top;
                            var left = $('.cropLand' + i)[0].getBoundingClientRect().left;
                            var info = { top: top, left: left, showed: 0 };
                            landInfo.push(info);
                        }
                        currentUser.SyndicateProgress = progress;
                        checkMissionInterval = setInterval(checkMission, 1000);
                        currentCharacter = "guard";
                        gameMode = "Guard";
                    }
                }
                else {
                    //check guard property stock
                    for (var i = 0; i < user_property.length; i++) {
                        if (user_property[i].propertyType == (currentUser.SyndicateLevel + 29)) {
                            if ((user_property[i].propertyCount == 0) && (user_property[i].tradeable == 0)) {
                                Meteor.call('updatePropertyCount_Setting', 1, 0);
                                // usingPropertyInstance.updatePropertyCount_Sudo(user_property[i].id, 1, 0, { from: web3.eth.accounts[currentAccount], gas: 2514068 });
                                user_property[i].propertyCount++;
                            }
                            break;
                        }
                    }
                    set_property_table();
                    sweetAlert("Oops...", "You are not assiged to any farm right now.", "error");
                    loading(0);
                    return;
                }
            }
        }
        else {
            currentCharacter = "farmer";

            showThief = false;
            clearInterval(checkMissionInterval);
            $(".missionObject").html("<div class='thiefObject'></div>");
            $('.SyndicateExp').css('visibility', 'collapse');
            $('.userExp').css('visibility', 'visible');
            $('.crop2').css('display', 'block');
            $('.functionSwitch').parent().find(".nextHome").remove();
            gameMode = "Farmer"
            rerenderCropLand(s_Id);
            loading(0);
        }
    },
    'mouseenter .flipDIV *': function (event) {
        if (gameMode == "Farmer") {
            $('.characterImg').addClass('flipped');
        } else {
            $('.characterImg').removeClass('flipped');
        }
    },
    'mouseout .flipDIV *': function (event) {
        if (gameMode == "Farmer") {
            $('.characterImg').removeClass('flipped');
        } else {
            $('.characterImg').addClass('flipped');
        }
    },

    // 'click .musicSwitch': function (event) {
    //     if (!audio.paused){
    //         audio.pause();
    //         $(".musicSwitch").find("img").attr("src", "/img/game/speaker_off.svg");
    //     }else{
    //         audio.play();
    //         $(".musicSwitch").find("img").attr("src", "/img/game/speaker_on.svg");
    //
    //     }
    //
    // },

    // 'mouseenter .userExp':function(event){
    //     $(".expHoverText").fadeIn();
    //     $(".expHoverText").css({"left":cursorX, "top":cursorY});
    // },
    // 'mouseout .userExp':function(event){
    //     $(".expHoverText").fadeOut();
    // },

})

Template.operationList.events({
    'click .menuButton': function (event) {
        if ($(".menuButton").hasClass("open") === true) {
            $(".rightMenuIcon").fadeOut('normal');
            $(".menuButton").removeClass("open");
        } else {
            $(".rightMenuIcon").fadeIn('normal');
            $(".menuButton").fadeTo("slow", 0.7);
            $(".menuButton").addClass("open");
        }
    },
    'click .shopOpen': function (e) {
        $(".property_shop").css("display", "inline");
        $(".mission_template").css("display", "none");
        $(".rank_template").css("display", "none");
        if (!ratingOpened) {
            set_propertyType_table();
        }
        ratingOpened = true;
    },
    'click .MissionOpen': function (event) {
        $(".property_shop").css("display", "none");
        $(".mission_template").css("display", "inline");
        $(".rank_template").css("display", "none");
        set_mission_table();
    },
    'click .rankOpen': function () {
        $(".property_shop").css("display", "none");
        $(".mission_template").css("display", "none");
        $(".rank_template").css("display", "inline");
        get_rank_data();
    }
})


/////////////////////////
//  Utility Functions  //
/////////////////////////


document.onmousemove = function (e) {
    cursorX = e.pageX;
    cursorY = e.pageY;
}

function wait(ms){
   var start = new Date().getTime();
   var end = start;
   while(end < start + ms) {
     end = new Date().getTime();
  }
}


var checkDBLoaded = function (callback) {
    var fetcher = setInterval(function () {
        if (Session.get("crop_loaded") && Session.get("land_loaded") && Session.get("mission_loaded") && Session.get("current_user_loaded") && Session.get("other_user_loaded")) {
            console.log("server connection established!");
            clearInterval(fetcher);
            callback("done");
        } else {
            console.log("establishing server connection... hold on!");
        }
    }, 1000);
}

var createDBConnection = function () {

    Session.set("crop_loaded", false);
    Session.set("land_loaded", false);
    Session.set("mission_loaded", false);
    Session.set("current_user_loaded", false);
    Session.set("other_user_loaded", false);

    propertyTypeSub = Meteor.subscribe("propertyTypeChannel", function(){
        Session.set("crop_loaded", true);
    });
    landTypeSub = Meteor.subscribe("landTypeChannel", function(){
        Session.set("land_loaded", true);
    });
    missionSub = Meteor.subscribe("missionChannel", function(){
        Session.set("mission_loaded", true);
    });

    userSub = Meteor.subscribe("currentUserChannel", function(){
        Session.set("current_user_loaded", true);
    });

    otherUserSub = Meteor.subscribe("otherUserChannel", function(){
        Session.set("other_user_loaded", true);
    });


    propertyTypeSub = Meteor.subscribe("propertyTypeChannel", function () {
        Session.set("crop_loaded", true);
    });
    landTypeSub = Meteor.subscribe("landTypeChannel", function () {
        Session.set("land_loaded", true);
    });
    missionSub = Meteor.subscribe("missionChannel", function () {
        Session.set("mission_loaded", true);
    });
    userSub = Meteor.subscribe("currentUserChannel", function () {
        Session.set("current_user_loaded", true);
    });

    otherUserSub = Meteor.subscribe("otherUserChannel", function () {
        Session.set("other_user_loaded", true);
    });
}

var initAllBtns = function () {
    var imgs = $(".cropLand").find("img");
    $(imgs[0]).parent().html("<img src = '" + prefix + "land" + postfix + "' />" + "Dirt");
    $(imgs[0]).parent().data('pressed', false);
    $(imgs[1]).parent().html("<img src = '/img/game/background.svg' />Grass");
    $(imgs[1]).parent().data('pressed', false);

    var imgs = $(".crop").find("img");

    for (var i = 0; i < imgs.length; i++) {
        if ($(imgs[i]).parent().data('pressed')) {
            $(imgs[i]).parent().html("<img src = '" + prefix + cropTypeList[i].img[3] + postfix + "' />" + cropTypeList[i].name);
            $(imgs[i]).parent().data('pressed', false);
        }
    }

    placeMode = false;
    plantMode = false;
    removeMode = false;
}

var eventListener = function () {

    // var events = MainActivityInstance.allEvents([{fromBlock: 0, toBlock: 'latest'}]);
    //
    // // watch for changes
    // events.watch(function(error, event){
    //   if (!error)
    //     console.log(event);
    // });

    // Or pass a callback to start watching immediately
    // var event = MainActivityInstance.matchSuccess({} , [{from: 0, to: 'latest'}] , function(error, result){
    //   if (!error)
    //     console.log(result);
    // });
    //
    // var event = MainActivityInstance.matchFail({} , [{fromBlock: 0, toBlock: 'latest'}] , function(error, result){
    //   if (!error)
    //     console.log(result);
    // });

    // watch for an event with {some: 'args'}
    //matchmakingbug
    //var events = MainActivityInstance.matchSuccess({fromBlock: 0, toBlock: 'latest'});
    //events.watch(function(error, result){
    //    console.log(result);
    //    updateUserData(s_Id);
    //    showConfirmation(s_Id);
    //});

    // would get all past logs again.
    events.get(function (error, logs) {
        console.log(logs);
    });

    //matchmakingbug
    //var events2 = MainActivityInstance.returnOrigin({fromBlock: 0, toBlock: 'latest'});
    //events2.watch(function(error, result){
    //    console.log(result);
    //});

    // would get all past logs again.
    events2.get(function (error, logs) {
        console.log(logs);
    });
}

var showConfirmation = function (s_Id) {
    var length = currentUser.matches.length;
    if (length > 0) {
        $(".systemInfo").css("transform", "translateX(0px)");
    } else {
        $(".systemInfo").css("transform", "translateX(600px)");
        return;
    }
    $(".matches").remove();

    for (var i = 0; i < length; i++) {
        //matchmakingbug
        var data = MainActivity2Instance.getMatchMaking.call(currentUser.matches[i], { from: web3.eth.accounts[currentAccount] });
        var owners = data[1];
        var properties = data[2];
        var tradeables = data[3];
        var index;

        for (var j = 0; j < owners.length; j++) {
            if (s_Id == owners[j].c[0]) {
                index = j;
            }
        }

        var previousIndex = (index - 1 + owners.length) % owners.length;

        var previousName = web3.toUtf8(CongressInstance.getStakeholder.call(parseInt(owners[previousIndex].c[0]), { from: web3.eth.accounts[currentAccount] })[0]);
        var type_Id = usingPropertyInstance.getPropertyType_Matchmaking.call(parseInt(properties[previousIndex].c[0]), { from: web3.eth.accounts[currentAccount] });
        var receiveProperty = usingPropertyInstance.getPropertyType.call(type_Id, { from: web3.eth.accounts[currentAccount] });

        type_Id = usingPropertyInstance.getPropertyType_Matchmaking.call(parseInt(properties[index].c[0]), { from: web3.eth.accounts[currentAccount] });
        var provideProperty = usingPropertyInstance.getPropertyType.call(type_Id, { from: web3.eth.accounts[currentAccount] });

        var row = $("<div>").attr("class", "matches match" + i);
        var fromAddr = $("<div>").text("from " + previousName);
        var receive = $("<div>").text("for " + web3.toUtf8(receiveProperty[0]) + "X" + tradeables[previousIndex].c[0]);
        var provide = $("<div>").text("You exchange " + web3.toUtf8(provideProperty[0]) + "X" + tradeables[index].c[0]);
        var checkBtn = $('<input>').attr({
            type: 'button',
            class: "btn btn-info matchesBtn matchBtn" + currentUser.matches[i].c[0],
            value: 'Confirm'
        });
        row.append(provide).append(receive).append(fromAddr).append(checkBtn);

        $(".systemInfo").append(row);

        var confirmed = MainActivity2Instance.getMatchMakingConfirmed.call(currentUser.matches[i], s_Id, { from: web3.eth.accounts[currentAccount] });
        if (confirmed) {
            $(".matchBtn" + currentUser.matches[i].c[0]).prop("value", "Waiting");
            $(".matchBtn" + currentUser.matches[i].c[0]).prop("disabled", true);
        }
    }
}

var getVisitNode = function () {
    var s_Length = CongressInstance.getStakeholdersLength.call({ from: web3.eth.accounts[currentAccount] }).c[0];

    visitNode = s_Id;
    while ((visitNode == s_Id) || (visitNode == 0)) {
        visitNode = Math.floor(s_Length * Math.random());
    }
    return visitNode;
}

var fetchAllCropTypes = function () {
    cropData = property_type.find().fetch()[0].data;
    landData = land_type.find().fetch()[0].data;
}

var loadCropList = function (s_Id) {
    cropList = [];
    var data = Meteor.users.findOne({ _id: Session.get("id") }).profile.game.cropList;

    var countData = data.count;
    var length = data.id.length;
    for (var i = 0; i < length; i++) {
        // TODO  check format
        // var start = web3.toUtf8(data[i].start).split(".")[0]+"Z";
        // var end = web3.toUtf8(data[i].end).split(".")[0]+"Z";
        // start = start.split("\"")[1];
        // end = end.split("\"")[1];
        var start = data.start[i];
        var end = data.end[i];

        cropList.push({
            id: data.id[i],
            name: data.name[i],
            img: data.img[i],
            start: new Date(start),
            end: new Date(end),
            type: data.cropType[i],
            ripe: data.ripe[i],
            count: data.count[i]
        });
    }
}


var getUserStockList = function (s_Id) {
    var p_List = Meteor.users.findOne({ _id: Session.get("id") }).profile.game.property;
    for (var i = 0; i < p_List.name.length; i++) {
        stockList.push({
            name: p_List.name[i],
            count: p_List.count[i],
            type: p_List.type[i],
            tradeable: p_List.tradeable[i],
            isTrading: p_List.isTrading[i]
        });
    }
}

var getUserData = function (s_Id) {
    var data = Meteor.users.findOne({ _id: Session.get("id") }).profile.game.stakeholder;
    var syndicateData = Meteor.users.findOne({ _id: Session.get("id") }).profile.game.syndicateData;
    var matches = data.matchesId;

    currentUser = {
        id: s_Id,
        address: Meteor.users.findOne({ _id: Session.get("id") }).profile.basic.address,
        name: data.name,
        exp: data.exp,
        totalExp: data.totalExp,
        type: Meteor.users.findOne({ _id: Session.get("id") }).profile.basic.character,
        landSize: data.landSize,
        level: data.level,
        sta: data.stamina,
        guardId: null,
        thiefId: null,
        SyndicateExp: syndicateData.exp,
        SyndicateTotalExp: syndicateData.totalExp,
        SyndicateLevel: syndicateData.level,
        SyndicateProgress: 0,
        matches: matches
    };
    var lastLogin = data.lastLogin;

    if (lastLogin == 0) {
        return;
    }

    // TODO : check last login format
    //lastLogin = web3.toUtf8(lastLogin).split(".")[0]+"Z";
    //lastLogin = new Date(lastLogin.split("\"")[1]);

    var difference = elapsedTime(lastLogin, new Date());

    currentUser.sta += Math.round(difference.getTime() / (1000 * 60));
    var staCap = staminaCap(currentUser.level);

    if (currentUser.sta >= staCap) {
        currentUser.sta = staCap;
    }
    // end = end.split("\"")[1];

}

var updateUserData = function (s_Id) {

    var oriData = Meteor.users.findOne({ _id: Session.get("id") }).profile.game;
    var data = oriData.stakeholder;
    var syndicateData = oriData.syndicateData;

    // var data = CongressInstance.getStakeholder.call(s_Id, { from: web3.eth.accounts[currentAccount] });
    // var syndicateData = CongressInstance.getSyndicateData.call(s_Id, { from: web3.eth.accounts[currentAccount] });
    // var matches = CongressInstance.getStakeholderMatches.call(s_Id, { from: web3.eth.accounts[currentAccount] });

    currentUser.exp = data.exp;
    currentUser.totalExp = data.totalExp;
    currentUser.landSize = data.landSize;
    currentUser.level = data.level;
    currentUser.SyndicateExp = syndicateData.exp;
    currentUser.SyndicateTotalExp = syndicateData.totalExp;
    currentUser.SyndicateLevel = syndicateData.level;
    currentUser.matches = data.matchesId;
}

var getLandConfiguration = function (s_Id) {
    userLandConfiguration = [];

    var data = Meteor.users.findOne({ _id: Session.get("id") }).profile.game.landConfig;
    landSize = Math.sqrt(data.land.length);

    var contractLandData = data.land;
    var contractCropData = data.crop;

    for (var i = 0; i < landSize * landSize; i++) {
        userLandConfiguration.push(
            {
                id: i,
                land: contractLandData[i],
                crop: contractCropData[i]
            }
        );
    }

}

var fetchGameInitConfig = function (s_Id) {
    userCropType = [];
    cropTypeList = [];
    landTypeList = [];

    userCropType = Meteor.users.findOne({ _id: Session.get("id") }).profile.game.stakeholder.unlockedCropType;

    for (var i = 0; i < userCropType.length; i++) {
        cropTypeList.push(cropData[userCropType[i]]);
    }

    for (var i = 0; i < landData.length; i++) {
        landTypeList.push(landData[i]);
    }
    Session.set('cropTypeList', cropTypeList);
    _crop.changed();
    Session.set('landTypeList', landTypeList);
}

var loading = function (on) {
    var opacity;
    $(".cropObject").css("display", "none");
    if (on) {
        $(".loading").css("display", "flex");
        $(".loading").css("opacity", 0.7);
    } else {
        setTimeout(function () {
            $(".loading").css("opacity", 0);
            setTimeout(function () {
                $(".loading").css("display", "none");
            }, 1000);
        }, 1000);
    }
}

var rerenderCropLand = function (id) {
    getLandConfiguration(id);
    loadCropList(id);
    fetchGameInitConfig(id); //bryant
    initCropLand(id);
    getUserStockList(id);
    loading(0);
}

var initCropLand = function (id) {
    $('.land').html("");
    $(".surfaceObject").html("");
    $(".surfaceObject").append("<div class='cropObject'></div>");
    $('.land').css("width", blockSize * landSize);
    $('.land').css("height", blockSize * landSize);

    for (var i = 0; i < landSize * landSize; i++) {
        $('.land').append("<div class='farm cropLand" + i + "'></div>");
        if (userLandConfiguration[i].land == -1) {
            $('.cropLand' + i).css("border", '1px solid black');
        }
    }

    landInfo = [];
    for (var i = 0; i < userLandConfiguration.length; i++) {

        if (userLandConfiguration[i].land == -1) {
            continue;
        }
        $(".farmObject").html("<img src = '" + prefix + landTypeList[userLandConfiguration[i].land].img + postfix + "' />");
        $(".farmObject").children().clone().appendTo(".cropLand" + i).css({ opacity: 1 });


        if (userLandConfiguration[i].crop == -1) {
            continue;
        }

        var top = $('.cropLand' + i)[0].getBoundingClientRect().top;
        var left = $('.cropLand' + i)[0].getBoundingClientRect().left;


        var landTop = ($(".canvas").height() - $(window).height()) / 2;
        var landLeft = ($(".canvas").width() - $(window).width()) / 2;

        var resizeOffsetX = ($(window).width() - 400) / 6.5;
        var areaLeft = $(".gamingArea").position().left;
        var divHeight = $(".cropObject").height() / 5;
        var divWidth = $(".cropObject").width() / 1.65;

        var posX = left + landLeft - areaLeft + divWidth - x + resizeOffsetX;

        var posY = top + landTop - divHeight - y;

        var styles = {
            top: posY,
            left: posX,
            width: "150px",
            height: "150px",
            position: "absolute",
            opacity: 1,
            "z-index": 2
        };

        var info = { top: posY, left: posX, showed: 0 };
        landInfo.push(info);

        var index = userLandConfiguration[i].crop;
        if (index == -1) {
            return;
        }

        var difference = elapsedTime(new Date(), cropList[index].end);
        var originDifference = elapsedTime(cropList[index].start, cropList[index].end);
        var percent = difference / originDifference;

        var typeIndex;
        for (var j = 0; j < cropTypeList.length; j++) {
            if (cropTypeList[j].id == cropList[index].type) {
                typeIndex = j;
                break;
            } else {
            }
        }

        if (percent > 0.6) {
            $(".cropObject").html("<img src = '" + prefix + cropTypeList[typeIndex].img[0] + postfix + "' />");
        }
        if (percent <= 0.6) {
            $(".cropObject").html("<img src = '" + prefix + cropTypeList[typeIndex].img[1] + postfix + "' />");
        }
        if (percent <= 0) {
            $(".cropObject").html("<img src = '" + prefix + cropTypeList[typeIndex].img[2] + postfix + "' />");
            //cropList[i].ripe = 1;
        }
        var stolenFlag = "f";
        if (cropList[index].count != cropTypeList[typeIndex].count) {
            $(".cropObject").html("<img src = '" + prefix + cropTypeList[typeIndex].img[4] + postfix + "' />");
            stolenFlag = "t";
        }
        $(".cropObject").clone().attr("class", "croppedObject croppedObject" + index).attr("cropCount", cropList[index].count).attr("stolenFlag", stolenFlag).appendTo(".surfaceObject").css(styles);
    }
    createCircle();

}

var levelCap = function (n) {
    var powerResult = 1;
    for (var i = 0; i < n; i++) {
        powerResult *= 2;
    }
    return powerResult * 100;
}

var SyndicateLevelCap = function (n) {
    return n * 100;
}

var staminaCap = function (n) {
    return 100 + n * 10;
}

var thiefNumber = function (n) {
    return n * 10;
}

var updateStaminaBar = function (consumedSta) {
    var staCap = staminaCap(currentUser.level);

    currentUser.sta -= consumedSta;
    var percent = (currentUser.sta / staCap) * 100;
    $(".staProgressBar").css("width", percent + "%");
    $(".staText").text(Math.floor(percent) + "%");
    //$(".staHoverText").text(currentUser.sta+"/"+staCap);
}

var updateUserStamina = function () {
    var staCap = staminaCap(currentUser.level);
    if (currentUser.sta >= staCap) {
        return;
    }
    currentUser.sta += 1;
    updateStaminaBar(0);

}

var updateUserExp = function (exp) {
    if (currentUser.level < 46) {
        currentUser.exp += parseInt(exp);
        currentUser.totalExp += currentUser.exp;
        var lvlCap = levelCap(currentUser.level);

        if (currentUser.exp >= lvlCap) {

            currentUser.level += 1;
            _character.changed();
            Session.set('userLevel', currentUser.level);
            currentUser.exp = currentUser.exp - lvlCap;

            //set stamina to full
            currentUser.sta = staminaCap(currentUser.level);
            updateStaminaBar(0);

            var db_totalExp = Meteor.users.findOne({ _id: Session.get("id") }).profile.game.stakeholder.totalExp;
            Meteor.call('updateUserExp', currentUser.exp);
            //CongressInstance.updateUserExp(s_Id, currentUser.exp, {from:web3.eth.accounts[currentAccount], gas:2000000});
            var p_Id = Math.floor(Math.random() * 3);
            Meteor.call('playerLevelUp', p_Id);

            levelUp("userLevel");
            getUserData(s_Id);
            lvlCap = levelCap(currentUser.level);
            if (currentUser.level % 5 == 0) {
                Meteor.call('moveUserLandPosition', currentUser.landSize);
                //GamePropertyInstance.moveUserLandPosition(s_Id, currentUser.landSize, {from:web3.eth.accounts[currentAccount], gas:2000000});
                $(".unlockCropId").html("<h3>Unlock Crop: " + cropTypeList[cropTypeList.length - 1].name + "</h3>");
            } else {
                $(".unlockCropId").html('');
            }
            rerenderCropLand(s_Id);
            lvlCap = levelCap(currentUser.level);
            Session.set("unlockCrop", cropTypeList.length - 1);

            // PlayerSettingInstance.playerLevelUp(s_Id, Math.floor(Math.random()*3), {from:web3.eth.accounts[currentAccount], gas:3000000}, function(){
            //     levelUp("userLevel");
            //     getUserData(s_Id);
            //     rerenderCropLand(s_Id);
            //     lvlCap = levelCap(currentUser.level);
            //     if (currentUser.level % 5 == 0){
            //         $(".unlockCropId").html("<h3>Unlock Crop: "+cropTypeList[cropTypeList.length-1].name+"</h3>");
            //     }else{
            //         $(".unlockCropId").html('');
            //     }

            //     getUserData(s_Id);
            //     if((currentUser.level % 5) == 0){
            //         GamePropertyInstance.moveUserLandPosition(s_Id, currentUser.landSize, {from:web3.eth.accounts[currentAccount], gas:2000000});
            //     }
            //     rerenderCropLand(s_Id);
            //     lvlCap = levelCap(currentUser.level);
            //     Session.set("unlockCrop", cropTypeList.length - 1);
            // });

        } else {
            var db_totalExp = Meteor.users.findOne({ _id: Session.get("id") }).profile.game.stakeholder.totalExp;
            Meteor.call('updateUserExp', currentUser.exp);
            //Meteor.users.update(Session.get("id"), { $set: { 'profile.game.stakeholder.exp': currentUser.exp, 'profile.game.stakeholder.totalExp': db_totalExp + currentUser.exp } });
            //CongressInstance.updateUserExp(s_Id, currentUser.exp, {from:web3.eth.accounts[currentAccount], gas:2000000});
        }

        var percent = Math.floor((currentUser.exp / lvlCap) * 100);
        $(".expProgressBar").css("width", percent + "%");
        $(".expText").text(percent + "%");
        //$(".expHoverText").text(currentUser.exp+ " / " +lvlCap);
    }
}

var updateSyndicateExp = function (exp) {
    if (currentUser.SyndicateLevel <= 9) {
        currentUser.SyndicateExp += parseInt(exp);
        currentUser.SyndicateTotalExp += currentUser.SyndicateExp;
        var lvlCap = SyndicateLevelCap(currentUser.SyndicateLevel);

        if (currentUser.SyndicateExp >= lvlCap) {
            if (Session.get('userCharacter') == "Guard") {
                setGuardProperty();
            }

            currentUser.SyndicateLevel += 1;
            $(".front").find("h3").text("LV. " + currentUser.SyndicateLevel);
            _character.changed();
            Session.set('SyndicateLevel', currentUser.SyndicateLevel);
            currentUser.SyndicateExp = currentUser.SyndicateExp - lvlCap;
            levelUp('Syndicate');
            lvlCap = SyndicateLevelCap(currentUser.SyndicateLevel);
        }
        Meteor.call('updateSyndicateExp', currentUser.SyndicateExp, currentUser.SyndicateLevel);
        //var db_totalExp = Meteor.users.findOne({ _id: Session.get("id") }).profile.game.syndicateData.totalExp;
        //Meteor.users.update(Session.get("id"), { $set: { 'profile.game.syndicateData.exp': currentUser.SyndicateExp, 'profile.game.syndicateData.totalExp': db_totalExp + currentUser.SyndicateExp, 'profile.game.syndicateData.level': currentUser.SyndicateLevel } });
        //CongressInstance.updateSyndicateExp(s_Id, currentUser.SyndicateExp, currentUser.SyndicateLevel,{from:web3.eth.accounts[currentAccount], gas:2000000});

        var percent = (currentUser.SyndicateExp / lvlCap) * 100;
        $(".SyndicateExpProgressBar").css("width", percent + "%");
        //$(".SyndicateExpText").text(currentUser.SyndicateExp+"/"+lvlCap);
    }
    //CongressInstance.updateSyndicateExp(s_Id, currentUser.SyndicateExp, currentUser.SyndicateLevel,{from:web3.eth.accounts[currentAccount], gas:2000000});

    var percent = Math.floor((currentUser.SyndicateExp / lvlCap) * 100);
    $(".SyndicateExpProgressBar").css("width", percent + "%");
    $(".SyndicateExpText").text(percent + "%");
}

var levelUp = function (_type) {
    if (_type == 'userLevel') {
        Session.set('Levelup', currentUser.level);
        Session.set('staminaCap', staminaCap(currentUser.level));
        Session.set('expCap', levelCap(currentUser.level));
    }
    else {
        Session.set('Levelup', currentUser.SyndicateLevel);
    }

    $(".levelUp").fadeIn().delay(5000).fadeOut();
}

var setGuardProperty = function () {
    var propertyIndex, userIndex;
    for (var i = 0; i < user_property.length; i++) {
        if ((user_property[i].propertyType - 29) == currentUser.SyndicateLevel) {
            propertyIndex = user_property[i].id;
            userIndex = i;
            break;
        }
    }
    user_property[userIndex].propertyCount = 0;
    user_property[userIndex].tradeable = 0;
    user_property[userIndex + 1].propertyCount = 1;
    user_property[userIndex + 1].tradeable = 0;
    Meteor.call('updatePropertyCount_Setting', propertyIndex, 1, 0);
    Meteor.call('updatePropertyCount_Setting', (propertyIndex + 1), 1, 0);
}

var setStealRate = function (visitNode) {
    var thisGuard_s_Id = Meteor.users.findOne({ 'profile.game.stakeholder.id': visitNode }).profile.stakeholder.guardId;
    var thisGuardLvl = 1;
    if (thisGuard_s_Id != 0) {
        var thisGuard = Meteor.users.findOne({ 'profile.game.stakeholder.id': thisGuard_s_Id });
        thisGuardLvl = thisGuard.syndicateData.level;
    }
    //var thisGuardId = CongressInstance.getGuardId.call(visitNode, { from: web3.eth.accounts[currentAccount] });
    // var thisGuardLvl;
    // if (thisGuardId != 0) {
    //     var GuardData = CongressInstance.getSyndicateData.call(thisGaurdId, { from: web3.eth.accounts[currentAccount] });
    //     thisGuardLvl = GuardData[2].c[0];
    // }
    // else {
    //     thisGuardLvl = 0;
    // }
    stealRate = ((80 * (thisGuardLvl / 10) - 40 * (currentUser.SyndicateLevel / 10)) + 32) / 100;
}

var checkMission = function () {
    if (showThief) {
        var maxCount = (thiefNumber(currentUser.SyndicateLevel) / 2);
        if ($('.thief').length > maxCount) {
            do {
                var removeRand = Math.round(Math.random() * maxCount);
            } while (removeRand >= $('.thief').length);
            var removeObj = $('.thief:eq(' + removeRand + ')');
            var removeIndex = removeObj.attr('bindIndex');
            landInfo[removeIndex].showed = 0;
            removeObj.css({ opacity: 0, transform: "translateY(50px)" });
            removeObj.remove();
        }
        else {
            var show;
            do {
                var rand = Math.round(Math.random() * userLandConfiguration.length);
                show = landInfo[rand].showed;
            } while (show != 0);

            var top = landInfo[rand].top;
            var left = landInfo[rand].left;

            var areaLeft = $(".gamingArea").position().left;
            var divHeight = $(".cropObject").height() / 5;
            var divWidth = $(".cropObject").width() / 1.65;

            var missionStyles = {
                top: top - (divHeight * 2),
                left: left - areaLeft + (divWidth * 3),
                width: "150px",
                height: "150px",
                position: "absolute",
                opacity: 1,
                "z-index": 5,
                display: 'inline'
            };

            var prob = Math.random() * 3;

            if (prob > 2) {
                $(".thiefObject").html("<img src = '/img/game/thief.gif' />");
                $(".thiefObject").clone().attr("class", "thief thief" + theifId++).appendTo(".missionObject").css(missionStyles).attr('bindIndex', rand);
                landInfo[rand].showed = 1;
            }
        }
    }
    else {
        $(".missionObject").html("<div class='thiefObject'></div>");
    }
}

var cropSummaryUpdate = function () {
    for (var i = 0; i < cropList.length; i++) {
        if (cropList[i].name == 0 || cropList[i].ripe) {
            continue;
        }
        var difference = elapsedTime(new Date(), cropList[i].end);
        var originDifference = elapsedTime(cropList[i].start, cropList[i].end);
        var percent = difference / originDifference;

        var index;
        for (var j = 0; j < cropTypeList.length; j++) {
            if (cropTypeList[j].id == cropList[i].type) {
                index = j;
                break;
            }
        }

        if (percent > 0.6) {
            $(".croppedObject" + cropList[i].id).find("img").attr("src", prefix + cropTypeList[index].img[0] + postfix);
        }
        if (percent <= 0.6) {
            $(".croppedObject" + cropList[i].id).find("img").attr("src", prefix + cropTypeList[index].img[1] + postfix);
        }
        if (percent <= 0) {
            if (cropList[i].count != cropTypeList[index].count) {
                $(".croppedObject" + cropList[i].id).find("img").attr("src", prefix + cropTypeList[index].img[4] + postfix);
            }
            else {
                $(".croppedObject" + cropList[i].id).find("img").attr("src", prefix + cropTypeList[index].img[2] + postfix);
            }
            cropList[i].ripe = 1;
            $(".timeLeft" + cropList[i].id).html("Ready to harvest");

            continue;
        }

        var diffData = (difference.getHours() - 8) + ' Hrs. ' + difference.getMinutes() + ' Mins. ' + difference.getSeconds() + " Secs";
        $(".timeLeft" + i).html(diffData);
    }
}

var elapsedTime = function (start, end) {
    //var elapsed = end.getTime() - start.getTime();
    var elapsed = end - start; // time in milliseconds
    var difference = new Date(elapsed);
    //var diff_days = difference.getDate();
    //var diff_hours = difference.getHours();
    //var diff_mins = difference.getMinutes();
    //var diff_secs = difference.getSeconds();
    //return difference;
    return difference;
}

// var farmObjectLoader = function(){
//     $('.land').css("width", blockSize*currentUser.landSize );
//     $('.land').css("height", blockSize*currentUser.landSize );
//
//     for (var i = 0 ; i < currentUser.landSize*currentUser.landSize; i++){
//         $('.land').append("<div class='farm cropLand" + i + "' style='border:1px solid black; border-style:solid;'></div>");
//     }
// }

/////////////////////////
//  Shop Functions  //
/////////////////////////

get_user_property = function () {
    user_property = [];
    var db_property = Meteor.users.findOne({ _id: Session.get("id") }).profile.game.property;
    for (var i = 0; i < db_property.name.length; i++) {
        user_property.push({ "id": db_property.id[i], "name": db_property.name[i], "propertyType": db_property.type[i], "propertyCount": db_property.count[i], "tradeable": db_property.tradeable[i], "img": cropData[db_property.type[i]].img[3] })
    }
}

get_propertyType_setting = async function (_length) {
    display_field = [];
    var property_type;

    property_type = await callPromise("callContract", "Property", "getPropertyType", []);

    console.log(property_type);
    property_type.sort(function(crop1, crop2){
        if (crop1[1] > crop2[1]) return 1;
        if (crop1[1] < crop2[1]) return -1;
        return 0;
    });
        console.log(property_type);

    if (property_type.length != _length){
        loading(0);
        sweetAlert("Oops... Something went wrong!", "Please try again later :(", "error");
        return;
    }

    for (var i = 0 ; i < property_type.length ; i++){
        var _name = property_type[i][0];
        var _id = property_type[i][1];
        var _rating = property_type[i][3];
        var _averageRating = property_type[i][2];
        var data = { "name": _name, "id": _id, "rating": _rating, "averageRating": _averageRating };
        display_field.push(data);
    }

    
}

set_property_table = function () {

    get_user_property();
    var table, tr, td;
    $('.tradeable_content').html('');
    table = $('<table></table>').attr('id', 'property_trade_table')
        .attr('class', 'property_shop_table');
    // for tip content
    var tipPropertyString = "";
    if (Session.get('userCharacter') == "Thief") {
        tipPropertyString = "It consists the crops which you gathered or stole.";
    } else {
        tipPropertyString = "It consists crops and guard of which level is decided by playing in Guard mode.";
    }
    //content
    var flag = 0;
    for (i = 0; i < user_property.length; i++) {
        if ((user_property[i].propertyCount != 0) || (user_property[i].tradeable != 0)) {
            if (flag == 0) {
                flag++;
                tr = $('<tr></tr>');
                // tr.append($('<th></th>').text('Property'));
                // tr.append($('<th></th>').text('Stock Number'));
                // tr.append($('<th></th>').text('Tradable Number'));
                tr.html(
                    '<th><div class="TradablePropertyTH">Property<div class="tipContainer tipContainerProperty"><img id="tipPropertyImg" src="/img/game/question-mark.png" alt=""><div class="tipPropertyText tipText">' + tipPropertyString + '</div></div></div></th><th>Stock Number</th><th><div class="TradableNumTH">Tradable Number<div class="tipContainer tipContainerTradable"><img id="tipTradableImg" src="/img/game/question-mark.png" alt=""><div class="tipTradableText tipText">The quantity of the crop which you want to provide for joining the exchange.</div></div></div></th>'
                );
                table.append(tr);
            }
            tr = $('<tr></tr>');
            td = $('<td></td>');
            td.append($('<img></img>', {
                src: prefix + user_property[i].img + postfix,
                style: 'width:50px; height:50px'
            })).append("<div>" + user_property[i].name + "</div>");
            tr.append(td);
            td = $('<td></td>');
            td.text(user_property[i].propertyCount);
            tr.append(td);
            td = $('<td></td>');
            td.append(
                $('<input></input>', {
                    type: 'text',
                    class: 'shop_tradable_input',
                    id: 'tradable_input_' + user_property[i].id,
                    value: user_property[i].tradeable
                })
                    .on('keydown', function (e) {
                        if ($.inArray(e.keyCode, [46, 8, 9, 27, 13, 110, 190]) !== -1 ||
                            (e.keyCode === 65 && (e.ctrlKey === true || e.metaKey === true)) ||
                            (e.keyCode >= 35 && e.keyCode <= 40)) {
                            return;
                        }
                        if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                            e.preventDefault();
                        }
                    })
                    .on('change', function (e) {
                        var _id = index_finder($(this).attr('id'), 'tradable_input_');
                        if (parseInt($(this).val(), 10) > parseInt($('#shop_stock_' + _id).val())) {
                            $(this).val($('#shop_stock_' + _id).val());
                        }
                        $('#shop_stock_' + _id)[0].parentNode.previousSibling.textContent = parseInt($('#shop_stock_' + _id).val(), 10) - parseInt($(this).val(), 10);
                    })
                    .on('click', function () {
                        $(this).select();
                    })
            );
            td.append($('<input></input>', {
                type: 'hidden',
                id: 'shop_stock_' + user_property[i].id,
                value: parseInt(user_property[i].propertyCount, 10) + parseInt(user_property[i].tradeable, 10)
            }));
            tr.append(td);
            table.append(tr);
        }
    }

    if (!flag) {
        tr = $('<tr></tr>');
        tr.append($('<th></th>').text('No Stock Found'));
        table.append(tr);
    }
    //content
    $('.tradeable_content').append(table);
}

index_finder = function (_source, _mask) {
    var res = _source.substring(_mask.length, _source.length);
    return res;
}

set_propertyType_table = async function () {
    loading(1);
    var res = await callPromise("callContract", "Property", "getPropertyTypeLength", []);
    get_propertyType_setting(res.result.results[0]);
    rend_propertyType_table(res.result.results[0]);
}

rend_propertyType_table = function (_length) {
    onchangedIndex = [];
    if (display_field.length != _length) {
        setTimeout(function () {
            rend_propertyType_table(_length);
        }, 1000);
    }
    else {
        var table, tr, td, property_index;
        loading(1);
        $('.shop_content').html(
            '<div class="ratingRange">Rating Tolerance<div class="tipTolerance tipContainer"><img src="/img/game/question-mark.png" alt=""><div class="tipToleranceText tipText">The lower represents that you can only accept the equipollently important crop while exchanging. The higher means you may not receive the expected crop, but the higher success rate will occur.</div></div><input type="range" value="0" max="100" min="0" step="1" id="ratingPercent"><label for="ratingPercent">0%</label></div><hr>'
        );
        $('#ratingPercent').on('change', function () {
            $('label[for = ratingPercent]').html($(this).val() + "%");
        });
        table = $('<table></table>').attr('id', 'property_table')
            .attr('class', 'property_shop_table');
        //header
        tr = $('<tr></tr>');
        // tr.append($('<th></th>').text('Property'));
        // tr.append($('<th></th>').text('Rating'));
        // tr.append($('<th></th>').text('AVG Rating'));
        tr.html('<th>Property</th><th><div class="RatingTH">Rating<div class="tipContainer tipContainerRating"><img id="tipRatingImg" src="/img/game/question-mark.png" alt=""><div class="tipRatingText tipText">It represents how important the crop is to you.</div></div></div></th><th><div class="AvgRatingTH">AVG Rating<div class="tipContainer tipContainerAvg"><img id="tipAvgRatingImg" src="/img/game/question-mark.png" alt=""><div class="tipAvgRatingText tipText">Current average rating from all the gamers.</div></div></div></th>'
        );
        table.append(tr);
        //header
        //content
        for (i = 0; i < display_field.length; i++) {
            tr = $('<tr></tr>');
            tr.append($('<td></td>').html("<div><div><img src = '" + prefix + (display_field[i].name.toLowerCase()) + postfix + "'/></div>" + "<div>" + display_field[i].name + "</div></div>"));
            td = $('<td></td>');
            td.append($('<label>').attr('for', 'rating' + i).html(display_field[i].rating));
            td.append($('<input>', {
                type: 'range',
                value: display_field[i].rating,
                max: 100,
                min: 0,
                step: 1,
                id: 'rating' + i
            }).on('change', function () {
                var id = $(this).attr('id').split("rating")[1];
                if (jQuery.inArray(id, onchangedIndex) == -1) {
                    onchangedIndex.push(id);
                }
                $('label[for = ' + $(this).attr('id') + ']').html($(this).val());
            })
            );
            tr.append(td);
            tr.append($('<td></td>').text(display_field[i].averageRating));
            table.append(tr);
        }
        //content
        $('.shop_content').append(table);
        loading(0);
    }
}

save_tradable_setting = function () {
    loading(1);
    for (i = 0; i < $('.shop_tradable_input').length; i++) {
        var _id = index_finder($('.shop_tradable_input')[i].id, 'tradable_input_');
        var _tradable = $('#tradable_input_' + _id).val();
        var _propertyCount = parseInt($('#shop_stock_' + _id).val(), 10) - parseInt(_tradable, 10);
        for (j = 0; j < user_property.length; j++) {
            if (user_property[j].id == _id) {
                user_property[j].propertyCount = _propertyCount;
                user_property[j].tradeable = _tradable;
                break;
            }
        }
        Meteor.call('updatePropertyCount_Setting', _id, _propertyCount, _tradable);
        // usingPropertyInstance.updatePropertyCount(_id, _propertyCount, _tradable, { from: web3.eth.accounts[currentAccount], gas: 200000 }, function (err, result) {
        //     if (err) {
        //         console.log(err);
        //     }
        // });
    }
    loading(0);
    sweetAlert("Congratulations!", "Setting Saved!", "success");
}

save_rating_setting = async function () {
    loading(1);
    var s_Length = Meteor.users.find().count();
    var s_Id = Meteor.users.findOne({ _id: Session.get("id") }).profile.game.stakeholder.id;
    for (i = 0; i < onchangedIndex.length; i++) {
        var _id = parseInt(display_field[onchangedIndex[i]].id, 10);
        var _rate = parseInt($('#rating' + onchangedIndex[i]).val(), 10);
        var res = await callPromise("callContract", "Property", "updatePropertyTypeRating", [_id, _rate * floatOffset, "update", s_Length, s_Id]);
        /*
        usingPropertyInstance.updatePropertyTypeRating(_id, _rate * floatOffset, "update", { from: web3.eth.accounts[currentAccount], gas: 200000 }, function (err, result) {
            if (err) {
                console.log(err);
            }
        });
        */
    }
    onchangedIndex = [];
    loading(0);
    sweetAlert("Congratulations!", "Rating Saved!", "success");
}

/////////////////////////
//  Mission Functions  //
/////////////////////////
var mission_list = [];

get_mission_list = function () {
    mission_list = [];
    var _missionList = mission.find().fetch()[0].data;
    var _missionAccountStatus = Meteor.users.findOne({ _id: Session.get("id") }).profile.game.mission.accountStatus;
    for (var i = 1; i < _missionList.length; i++) {
        if (_missionList[i].lvl_limitation > currentUser.level) {
            break;
        }
        if ((_missionList[i].status) && (!_missionAccountStatus[i])) {
            for (var j = 0; j < _missionList[i].missionItem.length; j++) {
                var target_property = find_propertyInfo(_missionList[i].missionItem[j].propertyId);
                _missionList[i].missionItem[j].name = target_property.name;
                _missionList[i].missionItem[j].img = target_property.img;
            }
            mission_list.push(_missionList[i]);
        }
    }
}

find_propertyInfo = function (item_id) {
    for (k = 0; k < user_property.length; k++) {
        if (user_property[k].propertyType == item_id) {
            target_crop = { name: user_property[k].name, img: user_property[k].img };
            return (target_crop);
        }
    }
}

set_mission_table = async function () {
    loading(1);
    await get_mission_list();
    await mission_rending();
}

mission_rending = function () {
    loading(1);
    $('.mission_template').html('');
    $('.mission_template').append($('<button></button>', {
        type: 'button',
        id: 'btn_mission_close',
        class: 'btnClose'
    })
        .on('click', function () { $('.mission_template').css('display', 'none'); }).text('X')
    ).append($('<div></div>', {
        class: 'mission_header'
    }).text('Mission'));

    var div, table, tr, td;
    div = $('<div></div>', { class: 'mission_content' })
    table = $('<table></table>', { id: 'mission_table' });
    //header
    tr = $('<tr></tr>');
    tr.append($('<th></th>').text('Mission'));
    tr.append($('<th></th>').text('Requirement'));
    tr.append($('<th></th>').text('Exp'));
    tr.append($('<th></th>').text('Submit'));
    table.append(tr);
    //header
    //content
    for (i = 0; i < mission_list.length; i++) {
        if (!mission_list[i].solved) {
            tr = $('<tr></tr>');
            td = $('<td></td>', {
                text: mission_list[i].name
            });
            tr.append(td);
            td = $('<td></td>');
            for (j = 0; j < mission_list[i].missionItem.length; j++) {
                td.append($('<img></img>', {
                    src: prefix + mission_list[i].missionItem[j].img + postfix,
                    alt: mission_list[i].missionItem[j].name
                }));
                td.append($('<span></span>', {
                    text: ' X ' + mission_list[i].missionItem[j].quantity
                }));
            }
            tr.append(td);
            td = $('<td></td>', {
                text: mission_list[i].exp
            });
            tr.append(td);
            td = $('<td></td>');
            td.append($('<input></input>', {
                type: 'hidden',
                id: 'mission_exp_' + mission_list[i].id,
                value: mission_list[i].exp
            }));
            td.append($('<input></input>', {
                type: 'hidden',
                id: 'mission_id_' + mission_list[i].id
            }));
            td.append($('<input></input>', {
                type: 'button',
                value: 'Submit',
                id: 'btn_mission_submit_' + mission_list[i].id
            })
                .on('click', function () {
                    var _id = index_finder($(this).prev('input').attr('id'), 'mission_id_');
                    var mission_qualify = mission_qualify_check(_id);
                    if (mission_qualify) {
                        mission_submit(_id);
                    }
                })
            );
        }
        tr.append(td);
        table.append(tr);
        div.append(table);
    }
    //content
    $('.mission_template').append(div);
    for (k = 0; k < mission_list.length; k++) {
        mission_qualify_check(mission_list[k].id);
    }
    loading(0);
}

mission_submit = async function (_id) {
    updateUserExp(parseInt($('#mission_exp_' + _id).val(), 10));
    var target_mission;
    for (i = 0; i < mission_list.length; i++) {
        if (mission_list[i].id == _id) {
            target_mission = mission_list[i];
            break;
        }
    }
    if (target_mission == undefined) {
        sweetAlert('Oops', 'System error! Please try again', 'error');
        return;
    }

    for (k = 0; k < target_mission.missionItem.length; k++) {
        for (i = 0; i < user_property.length; i++) {
            if (user_property[i].propertyType == target_mission.missionItem[k].propertyId) {
                user_property[i].propertyCount += (parseInt(target_mission.missionItem[k].quantity) * -1);
                Meteor.call('updatePropertyCount', i, (parseInt(target_mission.missionItem[k].quantity) * -1));
                //usingPropertyInstance.updatePropertyCount_MissionSubmit(user_property[i].id, user_property[i].propertyCount,  { from: web3.eth.accounts[currentAccount], gas: 2000000 });
                break;
            }
        }
    }
    Meteor.call('submitMission', _id, function () {
        //GameCoreInstance.submitMission(_id,  { from: web3.eth.accounts[currentAccount], gas: 2000000 });
        set_property_table();
        sweetAlert("Congratulations!", "Mission Completed!", "success");
        set_mission_table();
    });
}

mission_qualify_check = function (_id) {
    var target_mission;
    for (i = 0; i < mission_list.length; i++) {
        if (mission_list[i].id == _id) {
            target_mission = mission_list[i];
            break;
        }
    }
    var qualify = false;
    for (i = 0; i < target_mission.missionItem.length; i++) {
        qualify = false;
        for (j = 0; j < user_property.length; j++) {
            if (user_property[j].propertyType == target_mission.missionItem[i].propertyId) {
                if (parseInt(user_property[j].propertyCount, 10) >= parseInt(target_mission.missionItem[i].quantity, 10)) {
                    qualify = true;
                }
                else {
                    qualify = false;
                }
                break;
            }
        }
        if (!qualify) {
            break;
        }
    }

    if (qualify) {
        $('#btn_mission_submit_' + _id).css('display', 'block');
        return (true);
    }
    else {
        $('#btn_mission_submit_' + _id).css('display', 'none');
        return (false);
    }
}

get_rank_data = function () {
    loading(1);
    var rawData = Meteor.users.find().fetch();
    var rankData = [];
    for (var i = 0; i < rawData.length; i++) {
        obj = { 'name': rawData[i].profile.game.stakeholder.name, 'address': rawData[i].profile.basic.address, 'lv': rawData[i].profile.game.stakeholder.level };
        rankData.push(obj);
    }
    sorted = selectedSort(rankData);
    set_rank_table(sorted);
    loading(0);

}

set_rank_table = function (data) {
    $('.rank_template').html('');

    $('.rank_template').append($('<button></button>', {
        type: 'button',
        id: 'btn_rank_close',
        class: 'btnClose'
    })
        .on('click', function () { $('.rank_template').css('display', 'none'); }).text('X')
    ).append($('<div></div>', {
        class: 'rank_header'
    }).text('Rank'));

    var table, tr, td;
    table = $('<table></table>', { id: 'rank_table', class: 'rank_table' });
    //header
    tr = $('<tr></tr>');
    tr.append($('<th></th>', { text: 'Rank', style: 'width:5vw' }));
    tr.append($('<th></th>', { text: 'Name', style: 'width:8vw' }));
    tr.append($('<th></th>', { text: 'Address', style: 'width:20vw' }));
    tr.append($('<th></th>', { text: 'Lv', style: 'width:5vw' }));
    table.append(tr);
    //header
    //content
    var table_length;
    if (data.length > 2) {
        table_length = 2;
    }
    else {
        table_length = data.length;
    }
    var onboard = 0;
    for (i = 0; i < table_length; i++) {
        if (data[i].address == currentUser.address) {
            onboard = 1;
            tr = $('<tr></tr>', { class: "onBoard" });
        }
        else {
            tr = $('<tr></tr>');
        }
        td = $('<td></td>', { text: (i + 1) });
        tr.append(td);
        td = $('<td></td>', { text: data[i].name });
        tr.append(td);
        td = $('<td></td>', { text: data[i].address });
        tr.append(td);
        td = $('<td></td>', { text: data[i].lv });
        tr.append(td);
        table.append(tr);
    }
    if (onboard == 0) {
        for (i = 0; i < data.length; i++) {
            if (data[i].address == currentUser.address) {
                tr = $('<tr></tr>', { class: "onBoard" });
                td = $('<td></td>', { text: (i + 1) });
                tr.append(td);
                td = $('<td></td>', { text: data[i].name });
                tr.append(td);
                td = $('<td></td>', { text: data[i].address });
                tr.append(td);
                td = $('<td></td>', { text: data[i].lv });
                tr.append(td);
                table.append(tr);
            }
        }
    }

    $('.rank_template').append(table);
}

var selectedSort = function (data) {
    var tmp, max;
    for (i = 0; i < data.length; i++) {
        max = i;
        for (j = i + 1; j < data.length; j++) {
            if (data[j].lv > data[max].lv) {
                max = j;
            }
        }
        if (max != i) {
            tmp = data[i];
            data[i] = data[max];
            data[max] = tmp;
        }
    }
    return data;
}
