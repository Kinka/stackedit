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
            mappingKeyboard()

            $(".action-insert-image").click(function(e) {
                var value = utils.getInputTextValue($("#input-insert-image"), e);
                if (!startUpload.latest) return
                if (startUpload.latest.imageUrl === value) return
                // 重命名
                var newFileName = value.match(/\/([^/]+)$/)
                newFileName = newFileName && newFileName[1]
                if (!newFileName) return eventMgr.onMessage('识别不出文件名' + newFileName)

                var latest = startUpload.latest
                startUpload(latest.file, newFileName, latest.rev).then(function(res) {
                    latest.rev = res.rev
                    delImage(latest)
                })
            }).prev('.btn').click(function() {
                delImage(startUpload.latest)
            }) // cancel
		});
        eventMgr.addListener('onError', function(err) {
            if (err && err.message && err.message.startsWith('Error 401:'))
                $('.modal-kk-login').modal('show')
        })
        eventMgr.addListener('onTitleChanged', function(fileDesc) {
            var newTitle = fileDesc.title
            var url = settings.couchdbUrl.replace('documents', 'images');
            
            /** images/_design/title 修改文章title的时候，也同步修改图片的title字段
            {
                "doit": "function (doc, req) { if (!doc) return [doc, toJSON({status: 'not found'})]; doc.title = req.query.title; return [doc, toJSON({rev: doc._rev, title: doc.title, id: doc._id, status: 'ok'})];}"
            }
             */
            $.ajax({
                url: url + '/_design/title/_update/doit/' + fileDesc.fileIndex + '?' + $.param({title: newTitle}),
                type: 'PUT',
                contentType: false,
                processData: false,
                dataType: 'json'
            }).then(function(res) {
                console.log('updateTitle', res)
                return res
            })
        })
	};

    
    function delImage(latest) {
        if (!latest) return

        return $.ajax({
            url: latest.imageUrl + '?' + $.param({rev: latest.rev}),
            type: 'DELETE',
            dataType: 'json',
        }).then(function(res) {
            eventMgr.onMessage('file deleted: ' + latest.fileName)
            console.log('delete res', res)
            return res
        })
    }

    function armDateHelper() {  
        var editor = requirejs('./editor')
        $('.editor-content').keydown(function(e) {
            if (e.keyCode != 120 && e.keyCode != 121) return // F9 F10
            var d = new Date()
            var s;
            if (e.keyCode == 120)
                s = d.getFullYear() + '-' + zeroPack(d.getMonth() + 1) + '-' + zeroPack(d.getDate())
            else if (e.keyCode == 121)
                s = d.toTimeString().split(' ')[0]
            editor.replace(editor.selectionMgr.selectionStart, editor.selectionMgr.selectionEnd, s)
        })
        console.log(editor.selectionMgr)
        window.selectionMgr = editor.selectionMgr
        function zeroPack(n) {return n < 10 ? '0'+n : n}
    }

    function mappingKeyboard() {
        if (!navigator.userAgent.match(/Macintosh/i)) return
        var editor = requirejs('./editor')
        $('.editor-content').keydown(function(e) {
            if (e.key === 'Home' || e.key === 'End') {
                e.preventDefault()
            }
        }) 
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
                var fileName = 'paste_' + Date.now() + '.' + m[1].replace('e', '')
                $('#wmd-image-button').click()
                startUpload(file, fileName)
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
                        var fileName = ''
                        var name = a.pathname.split('/').pop()
                        if (name) fileName = name
                        if (!file.name) fileName = 'paste2_' + Date.now() + '.' + imageType.replace('e', '')
                        $('#wmd-image-button').click()
                        startUpload(file, fileName)
                    }
                })
            }
        })
    }
    function startUpload(file, fileName, rev) {
        startUpload.latest = undefined
        if (!file) return
        if (file.size >= 1 * 1024 * 1024) return alert('file size too large')

        fileName = fileName || file.name
        var inputInsertImage = $('#input-insert-image')
        var attachImage = $('#attach_image')

        var url = settings.couchdbUrl.replace('documents', 'images');
        var formData = new FormData()
        formData.append('_attachments', file, fileName)

        var currentFile = fileMgr.currentFile
        var docUrl = url + '/' + currentFile.fileIndex

        if (rev) {
            return doUpload(rev)
        } else {
            var p = $.ajax({type: 'HEAD', url: docUrl, cache: false, dataType: 'json'})
            
            p.error(function(xhr) {
                if (xhr.status != 404) return alert(xhr.status)
                return $.ajax({
                    url: url,
                    type: 'POST',
                    contentType: 'application/json',
                    dataType: 'json',
                    data: JSON.stringify({
                        _id: currentFile.fileIndex,
                        title: currentFile.title,
                    })
                }).then(function(res) {
                    return startUpload(file, fileName)
                })
            })

            return p.then(function(_, _, xhr) {
                var rev = JSON.parse(xhr.getResponseHeader('etag'))
                return doUpload(rev)
            })
        }

        function doUpload(rev) {
            var oldPH = inputInsertImage.attr('placeholder')

            formData.append('_rev', rev)
            return $.ajax({
                url: docUrl,
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
                processData: false,
                dataType: 'json'
            }).then(function(res) {
                var imageUrl = docUrl + '/' + fileName
                inputInsertImage.val(imageUrl)
                    .attr('placeholder', oldPH)
                attachImage.val('')
                eventMgr.onMessage('file uploaded: ' + fileName)
                startUpload.latest = {
                    file: file,
                    fileName: fileName,
                    rev: res.rev,
                    imageUrl: imageUrl,
                }
                console.log('doUpload', res)
                return res
            })
        }
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
