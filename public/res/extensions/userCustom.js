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
            armAutoUpload()
		});
	};

    function armAutoUpload() {
        var inputInsertImage = $('#input-insert-image')
        inputInsertImage.append($("<input type='file' id='attach_image' accept='image/*'/>"))

        var attachImage = $('#attach_image')
        attachImage.change(function() {startUpload(this.files[0])})

        inputInsertImage.prev('.input-group-addon')
            .css({cursor: 'pointer'}).attr('title', 'click to upload image')
            .click(function() {attachImage.click()})

        var editor = $('.editor-content')[0]
        editor.addEventListener('paste', function(evt) {
            var items = evt.clipboardData.items
            console.log(items)
            if (!items) return
        

            if (items.length == 1) {
                var item = items[0],
                    m = item.type.match(/image\/(jpeg|png|gif)/i)
                if (!m) return
                var file = item.getAsFile()
                file.name = Date.now() + '.' + m[1].replace('e', '')
                $('#wmd-image-button').click()
                startUpload(file)
            } else if (items.length == 2) {
                var text = items[0],
                    data = items[1];
                // right click and choose copy image from browser
                var imageType = data.type.match(/image\/(jpeg|png|gif)/i)
                imageType = imageType && imageType[1]

                if (text.type !== 'text/html' || !imageType) return

                var file = data.getAsFile()
                if (!file) return
                text.getAsString(function(html) {
                    var m = html.match(/src="(.*?)"/)
                    if (m && m[1] && m[1].search("data") !== 0) {
                        // getfilename
                        var a = document.createElement('a')
                        a.href = m[1]
                        var name = a.pathname.split('/').pop()
                        if (name) file.name = name
                        if (!file.name) file.name = Date.now() + '.' + imageType.replace('e', '')
                        $('#wmd-image-button').click()
                        startUpload(file)
                    }
                })
            }
        })
    }
    function startUpload(file) {
        if (!file) return
        if (file.size >= 1 * 1024 * 1024) return alert('file size too large')

        var inputInsertImage = $('#input-insert-image')
        var attachImage = $('#attach_image')

        var url = settings.couchdbUrl.replace('documents', 'attachments');
        var formData = new FormData()
        formData.append('_attachments', file, file.name)

        var locations = fileMgr.currentFile.syncLocations
        var editFile
        for (var xx in locations) {
            if (xx.indexOf('couchdb') > -1)
                editFile = locations[xx]
        }

        var oldPH = inputInsertImage.attr('placeholder')
        $.ajax({type: 'GET', url: url+'/'+editFile.title, cache: false, dataType: 'json'}).done(function(meta) {
            formData.append('_rev', meta._rev)
            $.ajax({
                url: url + '/' + editFile.title,
                type: 'POST',
                data: formData,
                xhr: function() {
                    var xhr = $.ajaxSettings.xhr()
                    xhr.upload.addEventListener('progress', function(evt) {
                        var percent = (evt.loaded/evt.total * 100).toFixed(0)
                        inputInsertImage.val('').attr('placeholder', percent + '%')
                    })
                    return xhr
                },
                contentType: false,
                processData: false
            }).done(function(res) {
                inputInsertImage.val(url + '/' + editFile.title + '/' + file.name)
                    .attr('placeholder', oldPH)
                attachImage.val('')
                eventMgr.onMessage('file uploaded: ' + file.name)
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
                startUpload(file)
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
