define([
	"jquery",
	"underscore",
	"utils",
	"classes/Extension",
	"fileSystem",
	"settings",
	"text!html/userCustomSettingsBlock.html",
	"text!html/kkLogin.html"
], function($, _, utils, Extension, fileSystem, settings, userCustomSettingsBlockHTML, kkLoginHTML) {

	var userCustom = new Extension("KkSE", "Kinka's Custom Extension", true);
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
            utils.addModal('modal-kk-login', _.template(kkLoginHTML, {}));
            armCouchdbLogin()
            armAutoUpload()
            armDateHelper()
		});
        eventMgr.addListener('onError', function(err) {
            if (err && err.message && err.message.startsWith('Error 401:'))
                $('.modal-kk-login').modal('show')
        })
	};

    function armDateHelper() {  
        var editor = requirejs('./editor')
        $('.editor-content').keydown(function(e) {
            if (e.keyCode != 120) return // F9
            var d = new Date()
            var s = d.getFullYear() + '-' + zeroPack(d.getMonth() + 1) + '-' + zeroPack(d.getDate())
            editor.replace(editor.selectionMgr.selectionStart, editor.selectionMgr.selectionEnd, s)
        })
        function zeroPack(n) {return n < 10 ? '0'+n : n}
    }

    function armCouchdbLogin() {
        var user = $('#couchdb_user'),
            pwd = $('#couchdb_pwd'),
            btnOK = $('#couchdb_submit');
        btnOK.click(function() {
            var url = settings.couchdbUrl.replace('documents', '_session');
            $.post(url, {name: user.val().trim(), password: pwd.val()})
            .done(function(data) {
                console.log(data)
                $('.modal-kk-login').modal('hide')
            }).error(function(data) {
                $('#couchdb_info').html(data.responseText);
            })
        })
    }

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

        var url = settings.couchdbUrl.replace('documents', 'images');
        var formData = new FormData()
        formData.append('_attachments', file, file.name)

        var currentFile = fileMgr.currentFile

        var oldPH = inputInsertImage.attr('placeholder')
        $.ajax({type: 'GET', url: url+'/'+currentFile.title, cache: false, dataType: 'json'}).done(function(meta) {
            formData.append('_rev', meta._rev)
            $.ajax({
                url: url + '/' + currentFile.title,
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
                inputInsertImage.val(url + '/' + currentFile.title + '/' + file.name)
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
                    _id: currentFile.title,
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
