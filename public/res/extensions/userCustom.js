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
        var file = $('#attach_image')[0].files[0]
        if (!file) return

        var url = settings.couchdbUrl.replace('documents', 'attachments');
        var formData = new FormData()
        formData.append('_attachments', file)

        var locations = fileMgr.currentFile.syncLocations
        var editFile
        for (var xx in locations) {
            if (xx.indexOf('couchdb') > -1)
                editFile = locations[xx]
        }

        $.ajax({type: 'GET', url: url+'/'+editFile.title, cache: false, dataType: 'json'}).done(function(meta) {
            formData.append('_rev', meta._rev)
            $.ajax({
                url: url + '/' + editFile.title,
                type: 'POST',
                data: formData,
                contentType: false,
                processData: false
            }).done(function(res) {
                $('#input-insert-image').val(url + '/' + editFile.title + '/' + file.name)
                console.log(res)
            })
        }).error(function(xhr) {
            if (xhr.status != 404) return alert(xhr.status)
            $.ajax({
                url: url,
                type: 'POST',
                contentType: 'application/json',
                dataType: 'json',
                data: JSON.stringify({
                    _id: editFile.title,
                    updated: Date.now()
                })
            }).done(function(res) {
                startUpload()
            })
        })
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
