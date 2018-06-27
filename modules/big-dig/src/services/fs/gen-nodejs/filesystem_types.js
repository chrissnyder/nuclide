/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @generated
 */

//
// Autogenerated by Thrift Compiler (0.11.0)
//
// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING
//
"use strict";

var thrift = require('thrift');
var Thrift = thrift.Thrift;
var Q = thrift.Q;


var ttypes = module.exports = {};
ttypes.ErrorCode = {
  'EPERM' : 1,
  'ENOENT' : 2,
  'EIO' : 5,
  'EBADF' : 9,
  'EACCES' : 13,
  'EBUSY' : 16,
  'EEXIST' : 17,
  'ENOTDIR' : 20,
  'EISDIR' : 21,
  'EINVAL' : 22,
  'EFBIG' : 27,
  'ENOSPC' : 28,
  'EROFS' : 30,
  'ENOTEMPTY' : 39,
  'ENOTSUP' : 95
};
ttypes.FileChangeEventType = {
  'UNKNOWN' : 1,
  'ADD' : 2,
  'DELETE' : 3,
  'UPDATE' : 4
};
ttypes.FileType = {
  'UNKNOWN' : 0,
  'FILE' : 1,
  'DIRECTORY' : 2,
  'SYMLINK' : 3
};
var Error = module.exports.Error = function(args) {
  Thrift.TException.call(this, "Error");
  this.name = "Error";
  this.code = null;
  this.message = null;
  if (args) {
    if (args.code !== undefined && args.code !== null) {
      this.code = args.code;
    }
    if (args.message !== undefined && args.message !== null) {
      this.message = args.message;
    }
  }
};
Thrift.inherits(Error, Thrift.TException);
Error.prototype.name = 'Error';
Error.prototype.read = function(input) {
  input.readStructBegin();
  while (true)
  {
    var ret = input.readFieldBegin();
    var fname = ret.fname;
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid)
    {
      case 1:
      if (ftype == Thrift.Type.I32) {
        this.code = input.readI32();
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRING) {
        this.message = input.readString();
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Error.prototype.write = function(output) {
  output.writeStructBegin('Error');
  if (this.code !== null && this.code !== undefined) {
    output.writeFieldBegin('code', Thrift.Type.I32, 1);
    output.writeI32(this.code);
    output.writeFieldEnd();
  }
  if (this.message !== null && this.message !== undefined) {
    output.writeFieldBegin('message', Thrift.Type.STRING, 2);
    output.writeString(this.message);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var FileChangeEvent = module.exports.FileChangeEvent = function(args) {
  this.eventType = null;
  this.fname = null;
  if (args) {
    if (args.eventType !== undefined && args.eventType !== null) {
      this.eventType = args.eventType;
    }
    if (args.fname !== undefined && args.fname !== null) {
      this.fname = args.fname;
    }
  }
};
FileChangeEvent.prototype = {};
FileChangeEvent.prototype.read = function(input) {
  input.readStructBegin();
  while (true)
  {
    var ret = input.readFieldBegin();
    var fname = ret.fname;
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid)
    {
      case 1:
      if (ftype == Thrift.Type.I32) {
        this.eventType = input.readI32();
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRING) {
        this.fname = input.readString();
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

FileChangeEvent.prototype.write = function(output) {
  output.writeStructBegin('FileChangeEvent');
  if (this.eventType !== null && this.eventType !== undefined) {
    output.writeFieldBegin('eventType', Thrift.Type.I32, 1);
    output.writeI32(this.eventType);
    output.writeFieldEnd();
  }
  if (this.fname !== null && this.fname !== undefined) {
    output.writeFieldBegin('fname', Thrift.Type.STRING, 2);
    output.writeString(this.fname);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var FileStat = module.exports.FileStat = function(args) {
  this.fsize = null;
  this.atime = null;
  this.mtime = null;
  this.ctime = null;
  this.ftype = null;
  if (args) {
    if (args.fsize !== undefined && args.fsize !== null) {
      this.fsize = args.fsize;
    }
    if (args.atime !== undefined && args.atime !== null) {
      this.atime = args.atime;
    }
    if (args.mtime !== undefined && args.mtime !== null) {
      this.mtime = args.mtime;
    }
    if (args.ctime !== undefined && args.ctime !== null) {
      this.ctime = args.ctime;
    }
    if (args.ftype !== undefined && args.ftype !== null) {
      this.ftype = args.ftype;
    }
  }
};
FileStat.prototype = {};
FileStat.prototype.read = function(input) {
  input.readStructBegin();
  while (true)
  {
    var ret = input.readFieldBegin();
    var fname = ret.fname;
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid)
    {
      case 1:
      if (ftype == Thrift.Type.I32) {
        this.fsize = input.readI32();
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRING) {
        this.atime = input.readString();
      } else {
        input.skip(ftype);
      }
      break;
      case 3:
      if (ftype == Thrift.Type.STRING) {
        this.mtime = input.readString();
      } else {
        input.skip(ftype);
      }
      break;
      case 4:
      if (ftype == Thrift.Type.STRING) {
        this.ctime = input.readString();
      } else {
        input.skip(ftype);
      }
      break;
      case 5:
      if (ftype == Thrift.Type.I32) {
        this.ftype = input.readI32();
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

FileStat.prototype.write = function(output) {
  output.writeStructBegin('FileStat');
  if (this.fsize !== null && this.fsize !== undefined) {
    output.writeFieldBegin('fsize', Thrift.Type.I32, 1);
    output.writeI32(this.fsize);
    output.writeFieldEnd();
  }
  if (this.atime !== null && this.atime !== undefined) {
    output.writeFieldBegin('atime', Thrift.Type.STRING, 2);
    output.writeString(this.atime);
    output.writeFieldEnd();
  }
  if (this.mtime !== null && this.mtime !== undefined) {
    output.writeFieldBegin('mtime', Thrift.Type.STRING, 3);
    output.writeString(this.mtime);
    output.writeFieldEnd();
  }
  if (this.ctime !== null && this.ctime !== undefined) {
    output.writeFieldBegin('ctime', Thrift.Type.STRING, 4);
    output.writeString(this.ctime);
    output.writeFieldEnd();
  }
  if (this.ftype !== null && this.ftype !== undefined) {
    output.writeFieldBegin('ftype', Thrift.Type.I32, 5);
    output.writeI32(this.ftype);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var FileEntry = module.exports.FileEntry = function(args) {
  this.fname = null;
  this.ftype = null;
  if (args) {
    if (args.fname !== undefined && args.fname !== null) {
      this.fname = args.fname;
    }
    if (args.ftype !== undefined && args.ftype !== null) {
      this.ftype = args.ftype;
    }
  }
};
FileEntry.prototype = {};
FileEntry.prototype.read = function(input) {
  input.readStructBegin();
  while (true)
  {
    var ret = input.readFieldBegin();
    var fname = ret.fname;
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid)
    {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.fname = input.readString();
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.I32) {
        this.ftype = input.readI32();
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

FileEntry.prototype.write = function(output) {
  output.writeStructBegin('FileEntry');
  if (this.fname !== null && this.fname !== undefined) {
    output.writeFieldBegin('fname', Thrift.Type.STRING, 1);
    output.writeString(this.fname);
    output.writeFieldEnd();
  }
  if (this.ftype !== null && this.ftype !== undefined) {
    output.writeFieldBegin('ftype', Thrift.Type.I32, 2);
    output.writeI32(this.ftype);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var WatchOpt = module.exports.WatchOpt = function(args) {
  this.recursive = null;
  this.excludes = null;
  if (args) {
    if (args.recursive !== undefined && args.recursive !== null) {
      this.recursive = args.recursive;
    }
    if (args.excludes !== undefined && args.excludes !== null) {
      this.excludes = Thrift.copyList(args.excludes, [null]);
    }
  }
};
WatchOpt.prototype = {};
WatchOpt.prototype.read = function(input) {
  input.readStructBegin();
  while (true)
  {
    var ret = input.readFieldBegin();
    var fname = ret.fname;
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid)
    {
      case 1:
      if (ftype == Thrift.Type.BOOL) {
        this.recursive = input.readBool();
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.LIST) {
        var _size0 = 0;
        var _rtmp34;
        this.excludes = [];
        var _etype3 = 0;
        _rtmp34 = input.readListBegin();
        _etype3 = _rtmp34.etype;
        _size0 = _rtmp34.size;
        for (var _i5 = 0; _i5 < _size0; ++_i5)
        {
          var elem6 = null;
          elem6 = input.readString();
          this.excludes.push(elem6);
        }
        input.readListEnd();
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

WatchOpt.prototype.write = function(output) {
  output.writeStructBegin('WatchOpt');
  if (this.recursive !== null && this.recursive !== undefined) {
    output.writeFieldBegin('recursive', Thrift.Type.BOOL, 1);
    output.writeBool(this.recursive);
    output.writeFieldEnd();
  }
  if (this.excludes !== null && this.excludes !== undefined) {
    output.writeFieldBegin('excludes', Thrift.Type.LIST, 2);
    output.writeListBegin(Thrift.Type.STRING, this.excludes.length);
    for (var iter7 in this.excludes)
    {
      if (this.excludes.hasOwnProperty(iter7))
      {
        iter7 = this.excludes[iter7];
        output.writeString(iter7);
      }
    }
    output.writeListEnd();
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var WriteFileOpt = module.exports.WriteFileOpt = function(args) {
  this.create = null;
  this.overwrite = null;
  if (args) {
    if (args.create !== undefined && args.create !== null) {
      this.create = args.create;
    }
    if (args.overwrite !== undefined && args.overwrite !== null) {
      this.overwrite = args.overwrite;
    }
  }
};
WriteFileOpt.prototype = {};
WriteFileOpt.prototype.read = function(input) {
  input.readStructBegin();
  while (true)
  {
    var ret = input.readFieldBegin();
    var fname = ret.fname;
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid)
    {
      case 1:
      if (ftype == Thrift.Type.BOOL) {
        this.create = input.readBool();
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.BOOL) {
        this.overwrite = input.readBool();
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

WriteFileOpt.prototype.write = function(output) {
  output.writeStructBegin('WriteFileOpt');
  if (this.create !== null && this.create !== undefined) {
    output.writeFieldBegin('create', Thrift.Type.BOOL, 1);
    output.writeBool(this.create);
    output.writeFieldEnd();
  }
  if (this.overwrite !== null && this.overwrite !== undefined) {
    output.writeFieldBegin('overwrite', Thrift.Type.BOOL, 2);
    output.writeBool(this.overwrite);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var DeleteOpt = module.exports.DeleteOpt = function(args) {
  this.recursive = null;
  if (args) {
    if (args.recursive !== undefined && args.recursive !== null) {
      this.recursive = args.recursive;
    }
  }
};
DeleteOpt.prototype = {};
DeleteOpt.prototype.read = function(input) {
  input.readStructBegin();
  while (true)
  {
    var ret = input.readFieldBegin();
    var fname = ret.fname;
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid)
    {
      case 1:
      if (ftype == Thrift.Type.BOOL) {
        this.recursive = input.readBool();
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

DeleteOpt.prototype.write = function(output) {
  output.writeStructBegin('DeleteOpt');
  if (this.recursive !== null && this.recursive !== undefined) {
    output.writeFieldBegin('recursive', Thrift.Type.BOOL, 1);
    output.writeBool(this.recursive);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var RenameOpt = module.exports.RenameOpt = function(args) {
  this.overwrite = null;
  if (args) {
    if (args.overwrite !== undefined && args.overwrite !== null) {
      this.overwrite = args.overwrite;
    }
  }
};
RenameOpt.prototype = {};
RenameOpt.prototype.read = function(input) {
  input.readStructBegin();
  while (true)
  {
    var ret = input.readFieldBegin();
    var fname = ret.fname;
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid)
    {
      case 1:
      if (ftype == Thrift.Type.BOOL) {
        this.overwrite = input.readBool();
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

RenameOpt.prototype.write = function(output) {
  output.writeStructBegin('RenameOpt');
  if (this.overwrite !== null && this.overwrite !== undefined) {
    output.writeFieldBegin('overwrite', Thrift.Type.BOOL, 1);
    output.writeBool(this.overwrite);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var CopyOpt = module.exports.CopyOpt = function(args) {
  this.overwrite = null;
  if (args) {
    if (args.overwrite !== undefined && args.overwrite !== null) {
      this.overwrite = args.overwrite;
    }
  }
};
CopyOpt.prototype = {};
CopyOpt.prototype.read = function(input) {
  input.readStructBegin();
  while (true)
  {
    var ret = input.readFieldBegin();
    var fname = ret.fname;
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid)
    {
      case 1:
      if (ftype == Thrift.Type.BOOL) {
        this.overwrite = input.readBool();
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

CopyOpt.prototype.write = function(output) {
  output.writeStructBegin('CopyOpt');
  if (this.overwrite !== null && this.overwrite !== undefined) {
    output.writeFieldBegin('overwrite', Thrift.Type.BOOL, 1);
    output.writeBool(this.overwrite);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

ttypes.ERROR_MAP = {
  1 : 'Operation not permitted.',
  2 : 'No such file or directory.',
  5 : 'Input/output error.',
  9 : 'Bad file descriptor.',
  13 : 'Permission denied.',
  16 : 'Resource busy or locked.',
  17 : 'File exists.',
  20 : 'File is not a directory.',
  21 : 'File is a directory.',
  22 : 'Invalid argument.',
  27 : 'File is too big.',
  28 : 'No space left on disk.',
  30 : 'Cannot modify a read-only file system.',
  39 : 'Directory is not empty.',
  95 : 'Operation is not supported.'
};
