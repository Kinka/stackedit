define([
	"jquery",
	"underscore",
	"utils",
	"classes/Extension",
	"fileSystem",
	"settings",
	"text!html/userCustomSettingsBlock.html",
	"text!html/tooltipUserCustomExtension.html"
], function($, _, utils, Extension, fileSystem, settings, userCustomSettingsBlockHTML, tooltipUserCustomExtensionHTML) {

	var userCustom = new Extension("userCustom", "UserCustom extension", true);
	userCustom.settingsBlock = userCustomSettingsBlockHTML;
	userCustom.defaultConfig = {
		code: ""
	};

	var fileMgr;
	userCustom.onFileMgrCreated = function(fileMgrParameter) {
		fileMgr = fileMgrParameter;
	};

	var synchronizer;
	userCustom.onSynchronizerCreated = function(synchronizerParameter) {
		synchronizer = synchronizerParameter;
	};

	var publisher;
	userCustom.onPublisherCreated = function(publisherParameter) {
		publisher = publisherParameter;
	};

	var eventMgr;
	userCustom.onEventMgrCreated = function(eventMgrParameter) {
		eventMgr = eventMgrParameter;
		eventMgr.addListener('onReady', function() {
			utils.createTooltip(".tooltip-usercustom-extension", tooltipUserCustomExtensionHTML);
            $('#input-insert-image').prev('.input-group-addon').click(uploadImage)
            $('#input-insert-image').append($("<input type='file' id='attach_image'/>"))
            $('#attach_image').change(startUpload)
//            console.log(fileMgr.currentFile)
		});
	};


    function uploadImage() {
        console.log('need uploadImage')
        var attachImage = $('#attach_image')
        attachImage.click()
    }
    function startUpload(e) {
        var file = this.files[0]
        var reader = new FileReader()
        reader.addEventListener('load', function() {
            $.ajax({
                type: 'POST',
                url: settings.couchdbUrl.replace('documents', 'attachments'),
                contentType: 'application/json',
                dataType: 'json',
                data: JSON.stringify({
                    _id: 'images',
                    updated: Date.now(),
                    _rev: '3-2a9d3b73d4158726aa71c760c77a4647',
                    _attachments: {
                        content: {data: utils.encodeBase64(reader.result)}
                    }
                })
            }).done(function(res) {console.log(res)})
        }, false)
        if (file)
            reader.readAsBinaryString(file)
    }

	userCustom.onLoadSettings = function() {
		utils.setInputValue("#textarea-usercustom-code", userCustom.config.code);
	};

	userCustom.onSaveSettings = function(newConfig, event) {
		newConfig.code = utils.getInputValue("#textarea-usercustom-code");
		try {
			/*jshint evil: true */
			eval(newConfig.code);
		}
		catch(e) {
			eventMgr.onError(e);
			// Mark the textarea as error
			utils.getInputTextValue("#textarea-usercustom-code", event, /^$/);
		}
	};

	userCustom.onInit = function() {
		try {
			/*jshint evil: true */
			eval(userCustom.config.code);
		}
		catch(e) {
			console.error(e);
		}
	};

	return userCustom;
});
